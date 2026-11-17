'use client';
import { useExperience } from './experience-context';
export default function PatientVisual({
  verified = false,
  onWristband,
  onRecord,
}: {
  verified?: boolean;
  onWristband?: () => void;
  onRecord?: () => void;
}) {
  const { t } = useExperience();
  return (
    <div className="patient-visual">
      <div className="room-grid" />
      <div className="scan-line" />
      <div className="room-corner top-left" />
      <div className="room-corner bottom-right" />
      <div className="visual-label">
        <span className="live-dot" /> BED-001 <span>/ SIM-001</span>
      </div>
      <svg className="patient-svg" viewBox="0 0 440 480" fill="none" aria-hidden="true">
        <defs>
          <linearGradient
            id="body"
            x1="130"
            y1="80"
            x2="310"
            y2="450"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#577ca7" stopOpacity=".8" />
            <stop offset="1" stopColor="#1d2c52" />
          </linearGradient>
          <radialGradient id="halo">
            <stop stopColor="#34d6d0" stopOpacity=".2" />
            <stop offset="1" stopColor="#34d6d0" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bed" x1="65" y1="30" x2="370" y2="450">
            <stop stopColor="#1d2d48" />
            <stop offset="1" stopColor="#10192d" />
          </linearGradient>
        </defs>
        <ellipse cx="220" cy="260" rx="190" ry="220" fill="url(#halo)" />
        <rect
          x="84"
          y="27"
          width="272"
          height="424"
          rx="42"
          fill="url(#bed)"
          stroke="#3c5472"
          strokeWidth="1.5"
        />
        <rect x="109" y="48" width="222" height="103" rx="24" fill="#263a56" stroke="#49617c" />
        <path
          d="M72 121v85m296-85v85M72 271v100m296-100v100"
          stroke="#526983"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <ellipse
          cx="220"
          cy="105"
          rx="40"
          ry="49"
          fill="url(#body)"
          stroke="#7298bd"
          strokeWidth="2"
        />
        <path
          d="M187 155h66l34 12q17 6 22 25l33 111q5 22-11 26-15 5-23-15l-26-71-6 93-14 87q-2 15-19 15-17 0-17-18l-6-82-6 82q0 18-17 18-17 0-19-15l-14-87-6-93-26 71q-8 20-23 15-16-4-11-26l33-111q5-19 22-25Z"
          fill="url(#body)"
          stroke="#6c94be"
          strokeWidth="2"
        />
        <path d="M174 187h92M173 250h94M166 322h108" stroke="#75b2ca" strokeOpacity=".2" />
        <path d="M220 181v120" stroke="#83c4d5" strokeOpacity=".22" strokeDasharray="4 7" />
        <circle
          cx="220"
          cy="213"
          r="36"
          fill="#3dd9d0"
          fillOpacity=".06"
          stroke="#40dcd0"
          strokeOpacity=".3"
        />
        <path
          d="M197 214h12l6-12 9 25 6-13h12"
          stroke="#69e4d4"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="m112 291 20 6" stroke={verified ? '#5fe0c3' : '#50dce3'} strokeWidth="11" />
        <path
          d="M124 298H63v-43H25M283 182h62v-28h50"
          stroke="#4cd9df"
          strokeOpacity=".5"
          strokeDasharray="4 4"
        />
      </svg>
      {onWristband && (
        <button
          className="hotspot wristband-spot"
          onClick={onWristband}
          aria-label="Open wristband / افتح سوار المريض"
        >
          <span className="hotspot-dot" />{' '}
          <span>
            {verified ? '✓ ' : ''}ID <small>01</small>
          </span>
        </button>
      )}
      {onRecord && (
        <button
          className="hotspot record-spot"
          onClick={onRecord}
          aria-label="Open medical record / افتح السجل الطبي"
        >
          <span className="hotspot-dot" />
          <span>
            MR <small>02</small>
          </span>
        </button>
      )}
      <div className="visual-footer">
        <span>{t('FICTIONAL PATIENT', 'مريض خيالي')}</span>
        <svg width="110" height="26" viewBox="0 0 110 26">
          <path d="M0 13h25l5-8 7 18 8-22 7 12h58" fill="none" stroke="#61ddce" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}
