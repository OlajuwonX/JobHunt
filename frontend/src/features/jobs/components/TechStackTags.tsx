'use client'

const MAX_VISIBLE = 3

interface TechStackTagsProps {
  techStack: string[]
}

export function TechStackTags({ techStack }: TechStackTagsProps) {
  if (!techStack.length) return null

  const visible = techStack.slice(0, MAX_VISIBLE)
  const remaining = techStack.length - MAX_VISIBLE

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((tag) => (
        <span
          key={tag}
          className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
        >
          {tag}
        </span>
      ))}
      {remaining > 0 && (
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          +{remaining} more
        </span>
      )}
    </div>
  )
}
