export type CommandCategory = 'File' | 'Edit' | 'Selection' | 'Run' | 'View' | 'Go' | 'Workspace'

export interface AppCommand {
  id: string
  title: string
  category: CommandCategory
  /** Extra words that should match in the palette. */
  keywords?: string
  /** Shortcut label such as "Mod+S", shown in the palette. */
  shortcut?: string
  enabled?: () => boolean
  run: () => void | Promise<void>
}

/** Every user facing action lives here, so the palette, shortcuts and menus share one source of truth. */
export class CommandRegistry {
  private readonly commands = new Map<string, AppCommand>()

  register(command: AppCommand): void {
    this.commands.set(command.id, command)
  }

  get(id: string): AppCommand | undefined {
    return this.commands.get(id)
  }

  list(): AppCommand[] {
    return [...this.commands.values()].filter((c) => !c.enabled || c.enabled())
  }

  async execute(id: string): Promise<void> {
    const command = this.commands.get(id)
    if (!command || (command.enabled && !command.enabled())) return
    await command.run()
  }
}
