import React from 'react';
import { Link } from 'react-router-dom';
import './landing.less';
import savingsBook1930s from './img/savings-book-1930s.jpg';
import savingsBook1912 from './img/savings-book-1912.jpg';
import redLedger from './img/red-ledger-cover.jpg';
import generalLedger from './img/general-ledger-cover.jpg';

// ---- the words ---------------------------------------------------------

const STEPS = [
  {
    say: 'The submissive sets the perimeter.',
    more: 'Tick what is in bounds, then rate every kink from hard limit to love. Nothing outside it can be assigned.',
  },
  {
    say: 'The dominant works inside it.',
    more: 'A hard limit blocks a task outright. A soft limit asks the dominant to confirm they have talked it through first.',
  },
  {
    say: 'Then you close the app.',
    more: 'Log what was done, review it, and go be in the same room. Either of you can pause or end it at any time.',
  },
];

const QUESTIONS = [
  {
    q: 'Does it enforce anything?',
    a: 'No. It records, and it blocks only what is out of bounds. Either of you can pause or end it at any time.',
  },
  {
    q: 'Who sees my profile?',
    a: 'Only your partner, and only once you confirm sharing. Never your username, never your other dynamics.',
  },
  {
    q: 'What happens to what I upload?',
    a: 'You choose how many days your partner can see each kind of proof. Then it is hidden, and soon after deleted.',
  },
  {
    q: 'Do I need an email?',
    a: 'No. A username, a password, and a recovery code shown once.',
  },
  {
    q: 'Can I use it alone?',
    a: 'Yes. Solo mode lets you assign yourself tasks and keep your own ledger.',
  },
];

const PICTURES = [
  {
    src: savingsBook1930s,
    alt: 'A savings book opened flat: handwritten entries in ruled columns, with round postal stamps down the right-hand page.',
    caption: 'Savings book, Poland, 1930s',
    href: 'https://commons.wikimedia.org/wiki/File:%D0%9A%D0%BD%D0%B8%D0%B6%D0%BA%D0%B0_%D1%81%D0%B1%D0%B5%D1%80%D0%B5%D0%B3%D0%B0%D1%82%D0%B5%D0%BB%D1%8C%D0%BD%D0%B0%D1%8F_%E2%84%96_880054_%D0%BF%D0%BE%D0%BB%D1%8C%D1%81%D0%BA%D0%BE%D0%B9_%D0%BF%D0%BE%D1%87%D1%82%D0%BE%D0%B2%D0%BE-%D1%81%D0%B1%D0%B5%D1%80%D0%B5%D0%B3%D0%B0%D1%82%D0%B5%D0%BB%D1%8C%D0%BD%D0%BE%D0%B9_%D0%BA%D0%B0%D1%81%D1%81%D1%8B._%D0%97%D0%B0%D0%BF%D0%B8%D1%81%D0%B8_%D0%BF%D0%BE_%D1%81%D1%87%D1%91%D1%82%D1%83--moneymuseum-by.jpg',
    licence: 'public domain',
  },
  {
    src: savingsBook1912,
    alt: 'A second savings book, its pages yellowed, ruled in columns and covered in control stamps.',
    caption: 'Savings book, Russian Empire, 1912–16',
    href: 'https://commons.wikimedia.org/wiki/File:%D0%9A%D0%BD%D0%B8%D0%B6%D0%BA%D0%B0_%D1%81%D0%B1%D0%B5%D1%80%D0%B5%D0%B3%D0%B0%D1%82%D0%B5%D0%BB%D1%8C%D0%BD%D0%B0%D1%8F_%D0%BF%D0%BE%D1%87%D1%82%D0%BE%D0%B2%D0%BE-%D1%82%D0%B5%D0%BB%D0%B5%D0%B3%D1%80%D0%B0%D1%84%D0%BD%D0%BE%D0%B9_%D0%B3%D0%BE%D1%81%D1%83%D0%B4%D0%B0%D1%80%D1%81%D1%82%D0%B2%D0%B5%D0%BD%D0%BD%D0%BE%D0%B9_%D1%81%D0%B1%D0%B5%D1%80%D0%B5%D0%B3%D0%B0%D1%82%D0%B5%D0%BB%D1%8C%D0%BD%D0%BE%D0%B9_%D0%BA%D0%B0%D1%81%D1%81%D1%8B._%D0%A1._2%E2%80%933--moneymuseum-by.jpg',
    licence: 'public domain',
  },
  {
    src: redLedger,
    alt: 'The cover of a worn red ledger, its cloth rubbed pale at the corners.',
    caption: 'Accounting journal, Kodak Archive',
    href: 'https://collections.museumsvictoria.com.au/items/2032549',
    licence: 'CC BY 4.0, Museums Victoria',
    drift: true,
  },
  {
    src: generalLedger,
    alt: 'A General Ledger, half bound in leather and blue cloth, with a handwritten label giving its dates.',
    caption: 'General ledger, 1922–26',
    href: 'https://collections.museumsvictoria.com.au/items/2030603',
    licence: 'CC BY 4.0, Museums Victoria',
    position: '50% 52%',
  },
];

// ---- the live control in the first screen -------------------------------

const BOUNDS = [
  { id: 'nothing', label: 'No underwear' },
  { id: 'threshold', label: 'Semi-private threshold' },
  { id: 'hoodie', label: 'Oversized hoodie' },
  { id: 'mirror', label: 'Full-length mirror' },
];
const NEEDS = ['nothing', 'threshold', 'hoodie'];

function BoundsDemo() {
  const [on, setOn] = React.useState({
    nothing: true,
    threshold: false,
    hoodie: true,
    mirror: true,
  });
  const missing = NEEDS.filter((id) => !on[id]).map(
    (id) => BOUNDS.find((b) => b.id === id).label,
  );
  const ready = missing.length === 0;

  return (
    <div className='frag' data-ui>
      <p className='frag-note'>What kitten has put in bounds</p>
      <ul className='frag-list'>
        {BOUNDS.map((b) => (
          <li key={b.id}>
            <label>
              <input
                type='checkbox'
                checked={on[b.id]}
                onChange={(e) => setOn({ ...on, [b.id]: e.target.checked })}
              />
              <span>{b.label}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className='frag-task'>
        <p>Step onto the porch in just the oversized hoodie, for 60 seconds.</p>
        <p className='frag-note'>
          Needs:{' '}
          {NEEDS.map((id) => BOUNDS.find((b) => b.id === id).label).join(', ')}
        </p>
      </div>
      <p className='frag-readout' role='status' aria-live='polite'>
        {ready
          ? 'Can be assigned.'
          : `Locked: ${missing.join(', ')} is not in bounds.`}
      </p>
      <button type='button' className='frag-button' disabled={!ready}>
        {ready ? 'Assign task' : 'Assign task (locked)'}
      </button>
    </div>
  );
}

// ---- the pinned stage: one fragment per statement -----------------------

const LEVELS = [
  'Hard limit',
  'Soft limit',
  'Indifferent',
  'Interested',
  'Like',
  'Love',
];
const RATED = [
  { name: 'Public humiliation', level: 0 },
  { name: 'Exhibitionism (subtle)', level: 1 },
  { name: 'High protocol', level: 5 },
];

function Stage({ active }) {
  return (
    <div className='stage' aria-hidden={false}>
      <div
        className={`frag stage-frag ${active === 0 ? 'is-active' : ''}`}
        data-ui
      >
        <p className='frag-note'>kitten, how do you feel about&hellip;</p>
        {RATED.map((r) => (
          <div className='rate' key={r.name}>
            <span>{r.name}</span>
            <span className='dots' aria-label={LEVELS[r.level]}>
              {LEVELS.map((l, i) => (
                <i key={l} className={i === r.level ? 'on' : ''} />
              ))}
            </span>
            <span className='rate-level'>{LEVELS[r.level]}</span>
          </div>
        ))}
      </div>
      <div
        className={`frag stage-frag ${active === 1 ? 'is-active' : ''}`}
        data-ui
      >
        <p className='frag-note'>
          Exhibitionism (subtle) is one of kitten&rsquo;s soft limits.
        </p>
        <p className='frag-ask'>
          Assignments should never be a surprise to your partner.
        </p>
        <p>I attest that we&rsquo;ve talked about this soft limit.</p>
        <div className='frag-actions'>
          <button type='button' className='frag-button'>
            Yes
          </button>
          <button type='button' className='frag-link'>
            Cancel
          </button>
        </div>
      </div>
      <div
        className={`frag stage-frag ${active === 2 ? 'is-active' : ''}`}
        data-ui
      >
        <p className='frag-note'>Today</p>
        <div className='entry'>
          <p>
            Step onto the porch in just the oversized hoodie, for 60 seconds.
          </p>
          <p className='frag-note'>
            Done 21:04 &middot; photo, visible to Sir for 7 days
          </p>
        </div>
        <div className='entry'>
          <p>Kneel quietly with your hands behind your head.</p>
          <p className='frag-note'>Done 21:10 &middot; held 1m 0s</p>
        </div>
        <p className='frag-readout'>Nothing left to do. Close the app.</p>
        <div className='frag-actions'>
          <button type='button' className='frag-link'>
            Pause
          </button>
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  const [active, setActive] = React.useState(0);
  const refs = React.useRef([]);

  React.useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined;
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(Number(entry.target.dataset.step));
          }
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    refs.current.forEach((node) => node && seen.observe(node));
    return () => seen.disconnect();
  }, []);

  return (
    <section className='hiw' aria-labelledby='hiw-title'>
      <Stage active={active} />
      <div className='hiw-steps'>
        <h2 id='hiw-title' data-reveal>
          How it works
        </h2>
        {STEPS.map((s, i) => (
          <div
            key={s.say}
            className={`step ${active === i ? 'is-current' : ''}`}
            data-step={i}
            ref={(node) => {
              refs.current[i] = node;
            }}
          >
            <p className='step-say' data-reveal>
              {s.say}
            </p>
            <p className='step-more' data-reveal>
              {s.more}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhyALedger() {
  return (
    <section className='col why' aria-labelledby='why-title'>
      <h2 id='why-title' data-reveal>
        Why a ledger
      </h2>
      <p className='why-lead' data-reveal>
        A ledger keeps count of what was agreed and what was done. It decides
        nothing. That is the app&rsquo;s whole job: record, remind, and get out
        of the way.
      </p>
      <div className='pictures'>
        {PICTURES.map((p) => (
          <figure key={p.src} data-reveal>
            <div className='frame'>
              <img
                src={p.src}
                alt={p.alt}
                width='640'
                height={p.position ? '480' : '480'}
                loading='lazy'
                className={p.drift ? 'drift' : ''}
                style={p.position ? { objectPosition: p.position } : undefined}
              />
            </div>
            <figcaption>
              <a href={p.href} target='_blank' rel='noreferrer'>
                {p.caption}
              </a>
              , {p.licence}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Questions() {
  const [open, setOpen] = React.useState(0);
  return (
    <section className='faq' aria-labelledby='faq-title'>
      <div className='faq-list'>
        <h2 id='faq-title' data-reveal>
          Questions
        </h2>
        <ul>
          {QUESTIONS.map((item, i) => (
            <li key={item.q} data-reveal style={{ '--i': i }}>
              <button
                type='button'
                className={open === i ? 'is-open' : ''}
                aria-expanded={open === i}
                onMouseEnter={() => setOpen(i)}
                onFocus={() => setOpen(i)}
                onClick={() => setOpen(i)}
              >
                <i aria-hidden='true' />
                {item.q}
              </button>
              <p className='faq-inline' hidden={open !== i}>
                {item.a}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <p className='faq-answer' key={open} aria-live='polite'>
        {QUESTIONS[open].a}
      </p>
    </section>
  );
}

// ---- the page ------------------------------------------------------------

export default function Landing() {
  const root = React.useRef(null);

  // Content stays visible without script; with it, parts rise once as they enter
  React.useEffect(() => {
    const node = root.current;
    node.classList.add('js');
    const targets = node.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      targets.forEach((t) => t.classList.add('is-in'));
      return undefined;
    }
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            seen.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    targets.forEach((t) => seen.observe(t));
    return () => seen.disconnect();
  }, []);

  return (
    <div className='landing' ref={root}>
      <section className='hero'>
        <div className='hero-left'>
          <Link to='/' className='mark'>
            The Compliance Ledger
          </Link>
          <div className='hero-copy'>
            <h1 className='lines'>
              <span className='line'>
                <span data-line style={{ '--i': 0 }}>
                  Boundaries first.
                </span>
              </span>
              <span className='line'>
                <span data-line style={{ '--i': 1 }}>
                  Then tasks.
                </span>
              </span>
            </h1>
            <p className='hero-sub' data-after>
              A private ledger for dominant and submissive pairs. The submissive
              sets what is in bounds; the dominant works inside it.
            </p>
            <p data-after>
              <Link to='/account?tab=signup' className='button'>
                Create an account
              </Link>
            </p>
          </div>
        </div>
        <div className='hero-right'>
          <Link to='/account' className='login'>
            Log in
          </Link>
          <BoundsDemo />
        </div>
      </section>

      <HowItWorks />
      <WhyALedger />
      <Questions />

      <section className='col cta'>
        <p className='cta-line' data-reveal>
          Set the boundaries together, then put the phone down and meet.
        </p>
        <p className='cta-actions' data-reveal>
          <Link to='/account?tab=signup' className='button'>
            Create an account
          </Link>
          <Link to='/account' className='text-link'>
            Log in
          </Link>
        </p>
      </section>

      <footer className='foot'>
        <span className='foot-left'>A private ledger for D/s pairs</span>
        <nav className='foot-links' aria-label='Footer'>
          <Link to='/account'>Log in</Link>
          <Link to='/account?tab=signup'>Sign up</Link>
          <Link to='/tools/scene-negotiation'>Tools</Link>
          <Link to='/about/info'>About</Link>
        </nav>
        <span className='foot-right'>
          2026 &middot; <Link to='/about/info#data-policy'>Data policy</Link>
        </span>
      </footer>
    </div>
  );
}
