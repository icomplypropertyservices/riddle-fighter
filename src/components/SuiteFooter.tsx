import { BRAND, SUITE, SUITE_NAV } from '../lib/suite'

export function SuiteFooter() {
  return (
    <footer className="suite-footer">
      <div className="suite-footer-inner">
        <div className="suite-footer-brand">
          <img
            src="/rdllogo-80.png"
            alt="Riddle"
            width={40}
            height={40}
            className="suite-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          <div>
            <p className="suite-footer-name">{BRAND.name}</p>
            <p className="suite-footer-desc">{BRAND.description}</p>
            <p className="suite-footer-disc">{BRAND.disclaimer}</p>
          </div>
        </div>
        <div className="suite-footer-links">
          <p className="suite-footer-kicker">Suite</p>
          <ul>
            {SUITE_NAV.map(({ key, label }) => (
              <li key={key}>
                <a href={SUITE[key]} target="_blank" rel="noopener noreferrer">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="suite-footer-copy">
        © {new Date().getFullYear()} {BRAND.suite} · {BRAND.shortName} · RDL ·{' '}
        <a href={SUITE.hub}>riddlewallet.com</a>
      </div>
    </footer>
  )
}
