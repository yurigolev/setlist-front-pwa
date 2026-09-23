import { cva } from 'class-variance-authority'

export const buttonVariants = cva('app-button', {
  variants: {
    variant: {
      primary: 'app-button--primary',
      ghost: 'app-button--ghost',
      icon: 'app-button--icon',
    },
  },
  defaultVariants: { variant: 'primary' },
})
