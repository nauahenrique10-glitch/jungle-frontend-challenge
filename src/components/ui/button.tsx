import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './utils'

// shadcn/ui Button pattern, adapted to Kurio tokens.
export const buttonVariants = cva('inline-flex items-center justify-center gap-2 rounded-md text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-5', { variants: { variant: { default: 'bg-primary text-primary-foreground hover:bg-primary/90', outline: 'border border-border text-foreground hover:bg-muted', ghost: 'text-primary hover:bg-muted' }, size: { default: 'min-h-11 px-5 py-2', icon: 'size-11' } }, defaultVariants: { variant: 'default', size: 'default' } })
export function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) { const Comp = asChild ? Slot : 'button'; return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props}/> }
