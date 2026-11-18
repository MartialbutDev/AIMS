import aimsIcon from '../assets/aims-logo-icon.png'

export function Brand() {
  return (
    <a className="brand" href="/" aria-label="AIMS home">
      <img className="brand-image" src={aimsIcon} alt="" aria-hidden="true" width={42} height={42} />
      <span className="brand-wordmark">
        <strong>AIMS</strong>
        <small>Academic Internship<br />Management System</small>
      </span>
    </a>
  )
}
