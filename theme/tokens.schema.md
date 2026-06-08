# Theme tokens contract

В [theme/tokens.css](tokens.css) ОБЯЗАТЕЛЬНО должны быть определены следующие CSS-переменные внутри блоков `:root` (light) и `.dark` (dark).

## Цвета (HSL без обёртки hsl(), пробел-разделённый формат)
- --color-background
- --color-foreground
- --color-primary
- --color-primary-fg
- --color-accent
- --color-muted
- --color-muted-fg
- --color-border
- --color-ring
- --color-danger

## Радиусы (в px)
- --radius-sm
- --radius-md
- --radius-lg

## Шрифты (имена next/font CSS-переменных или font-family)
- --font-display
- --font-text

## Принципы значений
- Цвета: формат `H S% L%`, например `217 91% 60%`.
- Радиусы: целое значение с `px`, например `6px`.
- Шрифты: `var(--font-...)` от next/font.
