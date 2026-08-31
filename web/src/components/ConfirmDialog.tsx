import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * 通用确认弹窗（task 08-31-delete-dialog-confirm）：
 * 基于 shadcn Dialog（fade-only 动画，勿加 zoom），文案全部由调用方
 * 经 t() 插值后传入 —— 组件自身不 import i18n，保持纯展示。
 */
export function ConfirmDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 标题（调用方 t() 后传入） */
  title: string;
  /** 描述文案，支持 i18next 插值（如子级数量 {{count}}） */
  description: string;
  /** 确认按钮文案 */
  confirmText: string;
  /** 取消按钮文案 */
  cancelText: string;
  /** 确认回调（请求由调用方发起） */
  onConfirm: () => void;
  /** 请求进行中：禁用两个按钮 */
  pending?: boolean;
  /** 确认按钮是否 destructive 样式（删除类操作） */
  destructive?: boolean;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={props.pending}
            onClick={() => props.onOpenChange(false)}
          >
            {props.cancelText}
          </Button>
          <Button
            type="button"
            variant={props.destructive ? "destructive" : "default"}
            disabled={props.pending}
            onClick={props.onConfirm}
          >
            {props.confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
