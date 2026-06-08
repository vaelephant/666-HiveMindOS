import './memory-evolution.css';

const CLIP_ID = 'wisdom-brain-clipping';

/** Uiverse — andrew-manzyk organic brain blob loader */
export function MemoryEvolutionBrainLoader() {
  return (
    <div className="brain-loader-host shrink-0" aria-hidden>
      <div className="brain-loader">
        <svg width={100} height={100} viewBox="0 0 100 100">
          <defs>
            <mask id={CLIP_ID}>
              <polygon points="0,0 100,0 100,100 0,100" fill="black" />
              <polygon points="25,25 75,25 50,75" fill="white" />
              <polygon points="50,25 75,75 25,75" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
            </mask>
          </defs>
        </svg>
        <div
          className="brain-loader-box"
          style={{
            mask: `url(#${CLIP_ID})`,
            WebkitMask: `url(#${CLIP_ID})`,
          }}
        />
      </div>
    </div>
  );
}
