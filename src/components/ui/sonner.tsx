import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton // 🔥 添加关闭按钮
      position="bottom-right" // 🔥 位置设置为右下角
      expand={false} // 🔥 不展开，保持紧凑
      richColors // 🔥 使用丰富的颜色
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton: "group-[.toast]:bg-background group-[.toast]:text-foreground group-[.toast]:border group-[.toast]:border-border !group-[.toast]:absolute !group-[.toast]:right-2 !group-[.toast]:left-auto !group-[.toast]:top-2", // 🔥 关闭按钮样式，调整到右侧
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
