
import { Icon } from '../../components/Icons'

interface ProjectInfo {
  label: string
  value: string
}

interface DeveloperRole {
  role: string
  name: string
}

const projectInfo: ProjectInfo[] = [
  {
    label: 'Project',
    value: 'Academic Internship Management System',
  },
  {
    label: 'Acronym',
    value: 'AIMS',
  },
  {
    label: 'Institution',
    value:
      'University of Science and Technology of Southern Philippines',
  },
  {
    label: 'College',
    value: 'College of Information Technology and Computing',
  },
  {
    label: 'Web Frontend',
    value: 'React, TypeScript, Vite',
  },
  {
    label: 'Backend',
    value: 'FastAPI',
  },
  {
    label: 'Mobile Application',
    value: 'React Native with Expo',
  },
]

const developerRoles: DeveloperRole[] = [
  {
    role: 'System Analyst',
    name: 'Maikent Jeorge C. Lopez',
  },
  {
    role: 'Database Administrator',
    name: 'Henna Christine C. Pajo',
  },
  {
    role: 'Technical Writer',
    name: 'Harry S. Fernandez',
  },
  {
    role: 'Frontend Developer',
    name: 'Faisal R. Inidal',
  },
  {
    role: 'Backend Developer',
    name: 'Varren Meg M. Naive',
  },
]

export function DeveloperInfoPage() {
  return (
    <section className="workspace-page">
      <div className="workspace-page-heading">
        <div>
          <span className="welcome-eyebrow">
            SYSTEM INFORMATION
          </span>

          <h1>Developer Information</h1>

          <p>
            Information about the AIMS project,
            technologies, and development team.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          marginTop: 24,
        }}
      >
        {/* PROJECT OVERVIEW */}

        <article
          className="panel"
          style={{ padding: 24 }}
        >
          <h2>Project Overview</h2>

          <p>
            AIMS is designed to support academic
            internship management, student monitoring,
            document submission, and evaluation.
          </p>

          <div className="info-list">
            {projectInfo.map((item) => (
              <div
                key={item.label}
                className="info-row"
              >
                <span>{item.label}</span>

                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        {/* DEVELOPMENT TEAM */}

        <article
          className="panel"
          style={{ padding: 24 }}
        >
          <h2>Development Team</h2>

          <p>
            AIMS capstone development team.
          </p>

          <div className="info-list">
            {developerRoles.map((developer) => (
              <div
                key={developer.role}
                className="info-row"
              >
                <span>{developer.role}</span>

                <strong>{developer.name}</strong>
              </div>
            ))}
          </div>
        </article>

        {/* SYSTEM ARCHITECTURE */}

        <article
          className="panel"
          style={{ padding: 24 }}
        >
          <h2>System Architecture</h2>

          <p>
            AIMS separates user interfaces,
            backend services, and data management.
          </p>

          <div className="info-list">
            <div className="info-row">
              <span>Web Application</span>

              <strong>
                Stakeholder Dashboards
              </strong>
            </div>

            <div className="info-row">
              <span>Mobile Application</span>

              <strong>
                Student Internship Portal
              </strong>
            </div>

            <div className="info-row">
              <span>API Framework</span>

              <strong>FastAPI</strong>
            </div>

            <div className="info-row">
              <span>Architecture</span>

              <strong>Page-Based</strong>
            </div>
          </div>
        </article>
      </div>

      {/* ABOUT AIMS */}

      <article
        className="panel"
        style={{
          padding: 24,
          marginTop: 24,
        }}
      >
        <h2>
          <Icon name="file" size={18} />
          {' '}About AIMS
        </h2>

        <p>
          The Academic Internship Management System
          provides a centralized platform for managing
          internship activities across students,
          coordinators, the Career Center, the Dean,
          host training establishments, and system
          administrators.
        </p>
      </article>
    </section>
  )
}
