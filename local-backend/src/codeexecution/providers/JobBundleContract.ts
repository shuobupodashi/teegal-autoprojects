/**
 * 🔥 Job Bundle 契约（本地 GpuWrapper ↔ 云端 Provider 内嵌脚本 的共享约定）
 *
 * 本模块是以下两端的唯一事实来源（单一事实源，禁止在两端各自硬编码）：
 * - 本地 GpuWrapper（组装 job bundle：注入 _OUTPUT_DIR/_files/_charts、URL 内网化）
 * - 云端 Provider 内嵌脚本（下载执行用户代码、产物迁移、黑名单上传、result.json 生成）
 *
 * 任何破坏性变更必须递增 JOB_BUNDLE_CONTRACT_VERSION，并确认两端同步更新。
 * 云端脚本顶部会嵌入契约头注释（jobBundleContractHeader），便于排查两端版本是否一致。
 */

/** 契约版本：产物目录/字段名/上传策略等破坏性变更时递增 */
export const JOB_BUNDLE_CONTRACT_VERSION = '1.0.0';

/**
 * 🔥 finalize.py 的固定 COS key（按契约版本固化）
 * 腾讯 CVM UserData 有 16KB base64 硬上限，云端执行/回收全量编排外置为 finalize.py：
 * 云端按契约版本构建（buildFinalizePy 在云端契约副本）并上传 COS 固定 key，开机 bootstrap 下载执行。
 */
export const FINALIZE_SCRIPT_KEY = `teegal-runtime/finalize_v${JOB_BUNDLE_CONTRACT_VERSION}.py`;

/** 云端统一输出目录（result.json、产物、full_log.txt 均在此目录） */
export const OUTPUT_DIR = '/tmp/output';

/** 多文件项目的项目目录（GpuWrapper 将文件写入此处并 chdir） */
export const PROJECT_DIR = '/tmp/project';

/** 云端缓存目录 */
export const CACHE_DIR = '/tmp/cache';

/** 训练全量日志文件名（位于 OUTPUT_DIR 内，tee 模式写入） */
export const LOG_FILE_NAME = 'full_log.txt';

/** 结果文件名（位于 OUTPUT_DIR 内），字段契约见 RESULT_JSON_FIELDS */
export const RESULT_JSON_NAME = 'result.json';

/**
 * result.json 字段契约（执行器 parseExecutionOutput 依赖，勿随意改名）
 * - charts/files 在 finalize 后必须为对象存储 URL（未上传成功的直接剔除，禁止回退本地路径——
 *   执行器会按 basename 重新签 URL，本地路径会变成 NoSuchKey 死链）；外部 http(s) URL 原样保留
 */
export const RESULT_JSON_FIELDS = {
  success: 'boolean',
  output: 'string',
  error: 'string?',
  charts: 'string[]（URL）',
  files: 'string[]（URL）',
  run_seconds: 'number（云端记录的真实运行时长，用于精确扣费）',
  warning: 'string?（训练成功但无产物时注入，前端与 LLM 可见）',
} as const;

/**
 * 上传黑名单后缀（缓存/临时文件不上传）
 * 🔥 黑名单排除式上传：/tmp/output 下除黑名单外全量上传、递归子目录拍平为顶层 key、
 *    顶层同名加 _N 序号防覆盖。白名单方案已废弃（新模型产物后缀层出不穷，漏配即 NoSuchKey 死链），勿再引入。
 */
export const UPLOAD_BLACKLIST_EXTS = ['.pkl', '.cache', '.tmp', '.log', '.pyc', '.pyo', '.pyd', '.part', '.swp'];

/** 产物自动迁移的目标后缀（yaml 是训练框架参数记录，如 YOLO args.yaml） */
export const PRODUCT_MIGRATE_EXTS = [
  '.pth', '.pt', '.onnx', '.bin', '.h5', '.ckpt', '.safetensors',
  '.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp',
  '.yaml', '.yml',
];

/** 产物自动迁移的扫描根目录（用户代码 chdir 到 PROJECT_DIR 后相对路径保存、或存到 /root、/home） */
export const PRODUCT_SCAN_BASES = [PROJECT_DIR, '/root', '/home'];

/** 产物自动迁移的单文件大小上限（防误迁大数据文件） */
export const PRODUCT_MIGRATE_MAX_BYTES = 200 * 1024 * 1024;

/** 产物迁移/上传遍历时排除的目录名 */
export const EXCLUDED_DIRS = ['__pycache__', 'node_modules', '.git', 'venv', '.venv', 'env'];

/**
 * 生成契约头注释（嵌入两端生成的云端脚本顶部，便于云端排查时确认两端版本一致）
 */
export function jobBundleContractHeader(): string {
  return `# teegal-job-bundle contract_version=${JOB_BUNDLE_CONTRACT_VERSION}`;
}

/**
 * 生成「全域产物自动迁移」Python 代码（两端共用，保持行为一致）
 *
 * 多文件项目 chdir 到 PROJECT_DIR 后相对路径保存、或用户存到 /root、/home、/tmp 顶层，
 * 这些产物只扫 OUTPUT_DIR 收不上来 → 统一迁移进 OUTPUT_DIR（必须在扫描上传前执行，迁移文件自然进上传列表）。
 * 跳过数据集目录（图片量大且非产物）；单文件超过大小上限跳过。
 */
export function buildMigrateProductsPy(): string {
  const exts = PRODUCT_MIGRATE_EXTS.map(e => `'${e}'`).join(', ');
  const bases = PRODUCT_SCAN_BASES.map(b => `'${b}'`).join(', ');
  const excludedDirs = EXCLUDED_DIRS.map(d => `'${d}'`).join(', ');
  const maxBytes = PRODUCT_MIGRATE_MAX_BYTES;
  return `
# 🔥 产物迁移：非规范路径（${PROJECT_DIR}、/root、/home、/tmp 顶层）→ ${OUTPUT_DIR}
#    只迁本次运行产生的模型/图表/配置文件（mtime >= 任务启动），跳过数据集目录与超大文件
import shutil as _shutil
_MIGRATED = []
_PRODUCT_EXTS = (${exts})
_SCAN_BASES = [${bases}]
# 🔥 只迁移本次运行期间产生/修改的文件（镜像制作期或历史残留的旧文件不是产物，防止莫名产物混入）
_TASK_START_TS = 0
try:
    with open('/tmp/.train_started_at') as _f:
        _TASK_START_TS = int(_f.read().strip())
except Exception:
    _TASK_START_TS = 0
try:
    for _fn in os.listdir('/tmp'):
        _p = os.path.join('/tmp', _fn)
        if os.path.isfile(_p) and os.path.splitext(_fn)[1].lower() in _PRODUCT_EXTS:
            if _TASK_START_TS and os.path.getmtime(_p) < _TASK_START_TS:
                continue
            _dst = os.path.join('${OUTPUT_DIR}', _fn)
            if not (os.path.exists(_dst) and os.path.getsize(_dst) == os.path.getsize(_p)):
                _shutil.copy2(_p, _dst)
                _MIGRATED.append(_fn)
except Exception:
    pass
for _base in _SCAN_BASES:
    if not os.path.isdir(_base):
        continue
    for _root, _dirs, _files in os.walk(_base):
        _dirs[:] = [x for x in _dirs if x not in (${excludedDirs}) and 'dataset' not in x.lower()]
        for _fn in _files:
            if os.path.splitext(_fn)[1].lower() not in _PRODUCT_EXTS:
                continue
            _src = os.path.join(_root, _fn)
            try:
                if os.path.getsize(_src) > ${maxBytes}:
                    continue
                if _TASK_START_TS and os.path.getmtime(_src) < _TASK_START_TS:
                    continue
                _dst = os.path.join('${OUTPUT_DIR}', _fn)
                if not (os.path.exists(_dst) and os.path.getsize(_dst) == os.path.getsize(_src)):
                    _shutil.copy2(_src, _dst)
                    _MIGRATED.append(_fn)
            except Exception:
                continue
if _MIGRATED:
    print(f"[teegal] 检测到产物保存到非规范路径，已自动迁移 {len(_MIGRATED)} 个到 ${OUTPUT_DIR}: {_MIGRATED[:10]}")
`;
}
