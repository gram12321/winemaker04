---
name: shadcn-best-practices
description: Use for ShadCN/Radix component composition and fixes in winemaker04 when editing existing UI components, design tokens, form controls, overlays, icons, or component source files.
---

# ShadCN Best Practices

## Purpose

Apply ShadCN/Radix UI composition, styling, and CLI guidance to Winemaker UI work. Use `../winemaker-game/SKILL.md` as the default repo router; this skill owns component-level UI conventions after repo boundaries are clear.

## Use When

- Editing components under `src/components/ui/` or UI surfaces that consume those components.
- Building forms, overlays, tabs, menus, tables, cards, empty states, feedback, or icons with existing ShadCN/Radix primitives.
- Fixing UI composition, accessibility, focus behavior, validation states, or semantic styling.
- Updating ShadCN component source while preserving local changes.
- Checking whether a component should use an installed primitive instead of custom markup.

## Repo Fit

Current stack: Vite SPA, React 19, TypeScript 5, Tailwind 3, ShadCN style `new-york`, Radix primitives, Lucide icons, and aliases from `components.json`.

- Prefer already-installed components and existing local patterns.
- Do not run `shadcn init` or preset migration commands unless the user explicitly asks.
- Avoid new registry dependencies unless explicitly requested.
- Keep page files orchestration-focused; push reusable UI into shared components.
- Preserve aliases such as `@/components/ui`, `@/lib/utils`, and `@/hooks`.
- Use semantic Tailwind tokens and existing CSS variables in `src/index.css`.

## Workflow

1. Read `components.json` and the existing local component source before changing composition.
2. Check installed components first; do not import components that are not present.
3. Use existing ShadCN/Radix primitives before custom styled markup.
4. Get component docs when adding, updating, or debugging unfamiliar APIs: `npx shadcn@latest docs <component>`, then fetch/read the returned docs and examples when available.
5. Preview upstream component updates with `npx shadcn@latest add <component> --dry-run` and `--diff`.
6. If the user asks for a registry block/component without naming a registry, ask which registry to use; do not guess.
7. Review all added or changed component files for imports, accessibility, icon handling, and local style consistency.
8. After adding community registry files, fix hardcoded default imports so they use this project's aliases from `components.json`.

## Core Rules

### Styling And Tailwind

- Use `className` for layout and spacing, not ad hoc color/typography overrides.
- Use semantic tokens such as `bg-background`, `text-muted-foreground`, `bg-primary`, and `border-border`.
- Use `gap-*` instead of `space-x-*` or `space-y-*`.
- Use `size-*` when width and height are equal.
- Use `truncate` shorthand.
- Use `cn()` for conditional classes.
- Avoid manual `dark:` color overrides and manual z-index on overlays.

### Forms And Inputs

- Forms use `FieldGroup` and `Field` where those local components exist.
- `InputGroup` uses `InputGroupInput` or `InputGroupTextarea`; do not place raw inputs inside it.
- Option sets with two to seven choices use `ToggleGroup`.
- Related checkbox/radio groups use `FieldSet` and `FieldLegend`.
- Validation uses `data-invalid` on the field wrapper and `aria-invalid` on the control.

### Composition And Accessibility

- Keep items inside their group components: `SelectItem` in `SelectGroup`, menu items in menu groups, command items in `CommandGroup`.
- Use `asChild` for Radix custom triggers.
- Dialog, Sheet, and Drawer content must have a title; use `sr-only` when visually hidden.
- Use complete Card, Tabs, Avatar, Alert, Empty, Separator, Skeleton, Badge, and Toast composition instead of custom markup.
- Compose button loading states with `Spinner`, `data-icon`, and `disabled`; `Button` has no `isPending` or `isLoading` prop.

### Icons

- Use Lucide icons for this repo unless a local component already uses another library.
- Icons in `Button` use `data-icon="inline-start"` or `data-icon="inline-end"`.
- Do not add manual sizing classes to icons inside components that already size icons.
- Pass icon components as objects where APIs expect icons; avoid string-key icon lookups.

## Component Selection

| Need | Use |
|---|---|
| Button/action | `Button` with an appropriate variant |
| Form inputs | `Input`, `Select`, `Combobox`, `Switch`, `Checkbox`, `RadioGroup`, `Textarea`, `InputOTP`, `Slider` |
| Toggle between 2-7 options | `ToggleGroup` and `ToggleGroupItem` |
| Data display | `Table`, `Card`, `Badge`, `Avatar` |
| Navigation | `Sidebar`, `Tabs`, `NavigationMenu`, `Breadcrumb`, pagination patterns |
| Overlays | `Dialog`, `Sheet`, `Drawer`, `AlertDialog`, `Popover`, `HoverCard`, `Tooltip` |
| Feedback | `sonner` toast, `Alert`, `Progress`, `Skeleton`, `Spinner` |
| Command palette | `Command` inside `Dialog` |
| Layout | `Card`, `Separator`, `Resizable`, `ScrollArea`, `Accordion`, `Collapsible` |
| Empty states | `Empty` |
| Menus | `DropdownMenu`, `ContextMenu`, `Menubar` |
| Charts | `Chart` wrappers around Recharts where present |

## CLI Rules

- Run CLI commands inside the project directory using `npx shadcn@latest` unless repo tooling changes.
- Never decode or fetch preset codes manually; pass them directly to the CLI.
- Never use `--overwrite` without explicit user approval.
- When updating from upstream, use `add --dry-run` and `add --diff`.
- Do not use the `diff` command; use `add --diff`.

## Reference Map

| Need | Reference |
|---|---|
| Styling and Tailwind examples | `rules/styling.md` |
| Forms and validation | `rules/forms.md` |
| Component composition | `rules/composition.md` |
| Icon handling | `rules/icons.md` |
| Radix vs Base API differences | `rules/base-vs-radix.md` |
| CLI commands and flags | `cli.md` |
| Theming and CSS variables | `customization.md` |
| MCP server tools | `mcp.md` |

## Verification

Use the smallest useful checks for the change. For finished code work, default to:

```bash
npm test
git diff --check
```

For visual or interaction changes, manually inspect the affected UI when tests do not cover it.
