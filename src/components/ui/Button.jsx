import './Button.css'

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  onClick,
  disabled = false,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    className={`btn btn-${variant} btn-${size} ${className}`}
    onClick={onClick}
    disabled={disabled}
    {...rest}
  >
    {children}
  </button>
)
