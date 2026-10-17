interface BrandProps {
  compact?: boolean
}

export function Brand({ compact = false }: BrandProps) {
  return (
    <a className={`brand${compact ? ' brand--compact' : ''}`} href="/" aria-label="AIMS home">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="brand-wordmark">
        <strong>AIMS</strong>
        {!compact && <small>USTP · INTERNSHIP MANAGEMENT</small>}
      </span>
    </a>
  )
}
