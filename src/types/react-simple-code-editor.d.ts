declare module 'react-simple-code-editor' {
  import { ComponentType } from 'react';

  interface EditorProps {
    value: string;
    onValueChange: (value: string) => void;
    highlight: (value: string) => string;
    padding?: number | string;
    className?: string;
    style?: React.CSSProperties;
    textareaClassName?: string;
    preClassName?: string;
    disabled?: boolean;
    placeholder?: string;
    autoFocus?: boolean;
    onFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
    onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onKeyUp?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onClick?: (event: React.MouseEvent<HTMLTextAreaElement>) => void;
    onDoubleClick?: (event: React.MouseEvent<HTMLTextAreaElement>) => void;
    onCut?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
    onCopy?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
    onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
    onScroll?: (event: React.UIEvent<HTMLTextAreaElement>) => void;
  }

  const Editor: ComponentType<EditorProps>;
  export default Editor;
}