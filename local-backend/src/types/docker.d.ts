declare module 'dockerode' {
  interface DockerOptions {
    host?: string;
    port?: number;
    socketPath?: string;
  }

  interface ContainerCreateOptions {
    Image: string;
    name?: string;
    HostConfig: HostConfig;
    StopTimeout?: number;
    AttachStdin?: boolean;
    AttachStdout?: boolean;
    AttachStderr?: boolean;
    Tty?: boolean;
    OpenStdin?: boolean;
    StdinOnce?: boolean;
  }

  interface HostConfig {
    Memory?: number;
    CpuShares?: number;
    NetworkMode?: string;
    AutoRemove?: boolean;
    Binds?: string[];
  }

  interface ExecCreateOptions {
    Cmd: string[];
    AttachStdout: boolean;
    AttachStderr: boolean;
  }

  class Exec {
    start(): Promise<any>;
  }

  class Container {
    id: string;
    start(): Promise<void>;
    stop(): Promise<void>;
    remove(options?: { force?: boolean }): Promise<void>;
    exec(options: ExecCreateOptions): Promise<Exec>;
  }

  class Image {
    inspect(): Promise<any>;
  }

  class Docker {
    constructor(options?: DockerOptions);
    createContainer(options: ContainerCreateOptions): Promise<Container>;
    getContainer(id: string): Container;
    getImage(name: string): Image;
    pull(repoTag: string, callback: (err: Error | null, stream: any) => void): void;
  }

  export = Docker;
}