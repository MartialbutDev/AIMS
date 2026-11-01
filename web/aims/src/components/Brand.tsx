import aimsIcon from '../assets/aims-logo-icon.png'

interface BrandProps {
  compact?: boolean
}

export function Brand({ compact = false }: BrandProps) {
  return (
    <a className={`brand${compact ? ' brand--compact' : ''}`} href="/" aria-label="AIMS home">
      <img className="brand-image" src={aimsIcon} alt="" aria-hidden="true" width={42} height={42} />
      <span className="brand-wordmark">
        <strong>AIMS</strong>
        {!compact && <small>USTP · INTERNSHIP MANAGEMENT</small>}
      </span>
    </a>
  )
}
