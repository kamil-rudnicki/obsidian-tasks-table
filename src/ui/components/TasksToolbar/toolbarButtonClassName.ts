// Toolbar controls are quiet until they hold a setting, then they take the
// accent color, as Sort and Filter do in Bases.
export const toolbarButtonClassName =
  'text-muted-foreground data-[active=true]:bg-active-surface data-[active=true]:text-active [@media(hover:hover)]:hover:text-foreground [@media(hover:hover)]:data-[active=true]:hover:bg-active-surface [@media(hover:hover)]:data-[active=true]:hover:text-active'
