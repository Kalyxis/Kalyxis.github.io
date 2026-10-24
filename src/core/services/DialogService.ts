import { useAppStore, type ChoiceOption } from '../../store/useAppStore'

export interface PromptOptions {
  title: string
  label?: string
  initial?: string
  placeholder?: string
  confirmLabel?: string
  multiline?: boolean
  /** Select only the part of a file name before its extension when the dialog opens. */
  selectStem?: boolean
  validate?: (value: string) => string | null
}

/** Promise based dialogs rendered by DialogHost. Only one dialog is shown at a time. */
export class DialogService {
  prompt(options: PromptOptions): Promise<string | null> {
    return this.open<string | null>((resolve) => ({
      kind: 'prompt',
      title: options.title,
      label: options.label,
      initial: options.initial ?? '',
      placeholder: options.placeholder,
      confirmLabel: options.confirmLabel ?? 'OK',
      multiline: options.multiline,
      selectStem: options.selectStem,
      validate: options.validate,
      resolve,
    }))
  }

  confirm(options: { title: string; message: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
    return this.open<boolean>((resolve) => ({
      kind: 'confirm',
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'Confirm',
      danger: options.danger,
      resolve,
    }))
  }

  choose(options: { title: string; message: string; options: ChoiceOption[] }): Promise<string | null> {
    return this.open<string | null>((resolve) => ({
      kind: 'choice',
      title: options.title,
      message: options.message,
      options: options.options,
      resolve,
    }))
  }

  private open<T>(build: (resolve: (value: T) => void) => NonNullable<ReturnType<typeof useAppStore.getState>['dialog']>): Promise<T> {
    // A new dialog replaces the old one, which counts as dismissed.
    const previous = useAppStore.getState().dialog
    if (previous) this.dismiss(previous)
    return new Promise<T>((resolve) => {
      const dialog = build((value) => {
        useAppStore.setState((s) => (s.dialog === dialog ? { dialog: null } : s))
        resolve(value)
      })
      useAppStore.setState({ dialog })
    })
  }

  private dismiss(dialog: NonNullable<ReturnType<typeof useAppStore.getState>['dialog']>): void {
    if (dialog.kind === 'confirm') dialog.resolve(false)
    else dialog.resolve(null)
  }
}
