import { Html, Line, OrbitControls, Stage } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './ArgoExplodedView.css';

const clamp01 = value => Math.min(1, Math.max(0, value));
const smoothstep = (edge0, edge1, value) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const STAGES = [
  ['Assembled', 'A cylindrical autonomous profiler built around a pressure hull'],
  ['Exterior reveal', 'The hull opens around the sensor head and working assembly'],
  ['Exploded view', 'Subsystems resolve along their natural assembly axes'],
  ['Component showcase', 'CTD, controller, power, buoyancy engine and ballast'],
  ['Scientific operation', 'Park · descend · profile · surface · transmit'],
  ['Reassembly', 'A core-float baseline, not a single manufacturer drawing']
];

function useScrollProgress(sectionRef) {
  const [progress, setProgress] = useState(0);
  const targetProgress = useRef(0);
  const animationFrame = useRef(0);

  useEffect(() => {
    const update = () => {
      const section = sectionRef.current;
      if (!section) return;
      const range = Math.max(1, section.offsetHeight - window.innerHeight);
      targetProgress.current = clamp01(-section.getBoundingClientRect().top / range);
    };
    const animate = () => {
      setProgress(current => {
        const next = current + (targetProgress.current - current) * 0.13;
        if (Math.abs(next - targetProgress.current) > 0.0005) {
          animationFrame.current = requestAnimationFrame(animate);
        } else {
          animationFrame.current = 0;
        }
        return next;
      });
    };
    const onScroll = () => {
      update();
      if (!animationFrame.current) animationFrame.current = requestAnimationFrame(animate);
    };
    update();
    animationFrame.current = requestAnimationFrame(animate);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(animationFrame.current);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [sectionRef]);

  return progress;
}

function MovingPart({ base, offset = [0, 0, 0], rotation = [0, 0, 0], explode, children }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (!ref.current) return;
    const easing = 1 - Math.pow(0.001, delta);
    ref.current.position.x = THREE.MathUtils.damp(ref.current.position.x, base[0] + offset[0] * explode, 5, delta);
    ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, base[1] + offset[1] * explode, 5, delta);
    ref.current.position.z = THREE.MathUtils.damp(ref.current.position.z, base[2] + offset[2] * explode, 5, delta);
    ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, rotation[0], 5, delta);
    ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, rotation[1], 5, delta);
    ref.current.rotation.z = THREE.MathUtils.damp(ref.current.rotation.z, rotation[2], 5, delta);
    void easing;
  });
  return <group ref={ref} position={base} rotation={rotation}>{children}</group>;
}

function Metal({ color = '#aab8bf', roughness = 0.28, metalness = 0.78, transparent = false, opacity = 1 }) {
  return <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} transparent={transparent} opacity={opacity} />;
}

function Hull({ explode }) {
  const opacity = THREE.MathUtils.lerp(0.96, 0.28, smoothstep(0.12, 0.55, explode));
  return (
    <>
      <MovingPart base={[0, 0.92, 0]} offset={[0, 1.12, 0]} explode={explode}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.88, 0.88, 1.82, 48]} />
          <Metal color="#d4a911" roughness={0.34} metalness={0.22} transparent={opacity < 0.95} opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.92, 0]} castShadow>
          <sphereGeometry args={[0.89, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Metal color="#d4a911" roughness={0.34} metalness={0.22} transparent={opacity < 0.95} opacity={opacity} />
        </mesh>
        <mesh position={[0, -0.72, 0]}>
          <torusGeometry args={[0.89, 0.025, 10, 48]} />
          <Metal color="#f0d766" roughness={0.28} metalness={0.4} transparent={opacity < 0.95} opacity={opacity} />
        </mesh>
      </MovingPart>
      <MovingPart base={[0, -0.92, 0]} offset={[0, -1.12, 0]} explode={explode}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.88, 0.88, 1.82, 48]} />
          <Metal color="#d4a911" roughness={0.34} metalness={0.22} transparent={opacity < 0.95} opacity={opacity} />
        </mesh>
        <mesh position={[0, -0.92, 0]}>
          <cylinderGeometry args={[0.88, 0.74, 0.24, 48]} />
          <Metal color="#c19c18" roughness={0.38} metalness={0.25} transparent={opacity < 0.95} opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.72, 0]}>
          <torusGeometry args={[0.89, 0.025, 10, 48]} />
          <Metal color="#f0d766" roughness={0.28} metalness={0.4} transparent={opacity < 0.95} opacity={opacity} />
        </mesh>
      </MovingPart>
      <mesh position={[0, 0.26, 0]}>
        <torusGeometry args={[0.9, 0.035, 12, 48]} />
        <meshStandardMaterial color="#f0d766" roughness={0.28} metalness={0.4} transparent={opacity < 0.95} opacity={opacity} />
      </mesh>
    </>
  );
}

function PressureCore({ explode }) {
  const opacity = smoothstep(0.18, 0.52, explode) * 0.84;
  return (
    <MovingPart base={[0, 0, 0]} offset={[0, 0, 0.08]} explode={explode}>
      <mesh castShadow>
        <cylinderGeometry args={[0.68, 0.68, 3.18, 40]} />
        <Metal color="#5d6972" roughness={0.25} metalness={0.78} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0, 1.58, 0]}>
        <torusGeometry args={[0.68, 0.026, 10, 40]} />
        <Metal color="#d3e0df" roughness={0.22} metalness={0.8} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0, -1.58, 0]}>
        <torusGeometry args={[0.68, 0.026, 10, 40]} />
        <Metal color="#d3e0df" roughness={0.22} metalness={0.8} transparent opacity={opacity} />
      </mesh>
    </MovingPart>
  );
}

function TopAssembly({ explode }) {
  return (
    <MovingPart base={[0, 2.02, 0]} offset={[0, 1.42, 0]} explode={explode}>
      <mesh castShadow>
        <cylinderGeometry args={[0.62, 0.78, 0.42, 40]} />
        <Metal color="#1d242b" roughness={0.3} metalness={0.72} />
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.72, 24]} />
        <Metal color="#c3d1d4" roughness={0.2} metalness={0.82} />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <torusGeometry args={[0.29, 0.025, 10, 24]} />
        <Metal color="#6e7d83" roughness={0.25} metalness={0.76} />
      </mesh>
      <mesh position={[0, 0.62, 0.08]} castShadow>
        <boxGeometry args={[0.38, 0.18, 0.24]} />
        <meshStandardMaterial color="#174e46" roughness={0.42} metalness={0.32} />
      </mesh>
      {[[-0.1, 0.75, 0.08], [0, 0.75, 0.08], [0.1, 0.75, 0.08]].map(([x, y, z]) => (
        <mesh key={`${x}-${y}`} position={[x, y, z]}>
          <cylinderGeometry args={[0.025, 0.025, 0.24, 12]} />
          <Metal color="#d1e3e2" roughness={0.24} metalness={0.72} />
        </mesh>
      ))}
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 1.05, 12]} />
        <Metal color="#171d25" roughness={0.22} metalness={0.82} />
      </mesh>
      <mesh position={[0, 1.38, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.18, 0.26, 24]} />
        <Metal color="#11171c" roughness={0.3} metalness={0.7} />
      </mesh>
    </MovingPart>
  );
}

function StabilityDisk({ explode }) {
  return (
    <MovingPart base={[0, 0.34, 0]} offset={[0, 0.18, 0]} explode={explode}>
      <mesh castShadow>
        <cylinderGeometry args={[1.2, 1.2, 0.09, 48]} />
        <Metal color="#2b333b" roughness={0.5} metalness={0.7} />
      </mesh>
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[1.05, 0.035, 10, 48]} />
        <Metal color="#6e858c" roughness={0.28} metalness={0.82} />
      </mesh>
    </MovingPart>
  );
}

function Electronics({ explode }) {
  return (
    <MovingPart base={[0, 1.1, 0]} offset={[0.34, 0.55, 0.12]} rotation={[0, 0, -0.04]} explode={explode}>
      <mesh castShadow>
        <boxGeometry args={[0.46, 1.24, 0.09]} />
        <meshStandardMaterial color="#195849" roughness={0.45} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.22, 0.07]}>
        <boxGeometry args={[0.22, 0.12, 0.04]} />
        <meshStandardMaterial color="#c5a92d" roughness={0.35} metalness={0.65} />
      </mesh>
      <mesh position={[0, -0.25, 0.07]}>
        <boxGeometry args={[0.28, 0.08, 0.04]} />
        <meshStandardMaterial color="#88c9a6" roughness={0.4} metalness={0.3} />
      </mesh>
    </MovingPart>
  );
}

function Battery({ explode }) {
  return (
    <MovingPart base={[-0.32, -0.7, 0]} offset={[-0.56, -0.32, 0]} explode={explode}>
      <mesh castShadow>
        <cylinderGeometry args={[0.26, 0.26, 1.25, 32]} />
        <meshStandardMaterial color="#a63c28" roughness={0.42} metalness={0.18} />
      </mesh>
      {[-0.1, 0, 0.1].map(x => (
        <mesh key={x} position={[x, 0, 0.18]}>
          <cylinderGeometry args={[0.065, 0.065, 1.05, 18]} />
          <meshStandardMaterial color="#c85632" roughness={0.36} metalness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.06, 24]} />
        <Metal color="#c7d0ce" roughness={0.2} metalness={0.85} />
      </mesh>
    </MovingPart>
  );
}

function BuoyancyEngine({ explode }) {
  return (
    <MovingPart base={[0.03, -0.18, 0]} offset={[0.78, -0.22, 0.1]} explode={explode}>
      <mesh castShadow>
        <cylinderGeometry args={[0.19, 0.19, 0.82, 24]} />
        <Metal color="#bd8e3e" roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.2, 24]} />
        <meshStandardMaterial color="#9e762f" roughness={0.38} metalness={0.38} />
      </mesh>
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.18, 24]} />
        <Metal color="#59636a" roughness={0.28} metalness={0.8} />
      </mesh>
      <mesh position={[0, -0.92, 0.02]} scale={[1, 0.55, 0.75]} castShadow>
        <sphereGeometry args={[0.48, 32, 18]} />
        <meshStandardMaterial color="#d48643" roughness={0.46} metalness={0.08} transparent opacity={0.92} />
      </mesh>
      <Line points={[[0.18, -0.56, 0.03], [0.18, -0.92, 0.03]]} color="#d6c17b" transparent opacity={0.8} lineWidth={1.4} />
    </MovingPart>
  );
}

function Ballast({ explode }) {
  return (
    <MovingPart base={[-0.36, -1.62, 0.05]} offset={[-0.62, -0.46, 0]} explode={explode}>
      <mesh castShadow>
        <cylinderGeometry args={[0.14, 0.18, 0.58, 24]} />
        <Metal color="#252c31" roughness={0.46} metalness={0.8} />
      </mesh>
      <mesh position={[0.72, 0, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.18, 0.58, 24]} />
        <Metal color="#252c31" roughness={0.46} metalness={0.8} />
      </mesh>
    </MovingPart>
  );
}

function PumpAssembly({ explode }) {
  return (
    <MovingPart base={[0, -0.15, 0]} offset={[0.58, -0.2, 0.14]} explode={explode}>
      <mesh castShadow>
        <cylinderGeometry args={[0.17, 0.17, 1.52, 24]} />
        <Metal color="#bd8e3e" roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh position={[0, -0.72, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.2, 24]} />
        <Metal color="#59636a" roughness={0.28} metalness={0.8} />
      </mesh>
    </MovingPart>
  );
}

function LowerSensor({ explode }) {
  return (
    <MovingPart base={[0, -1.55, 0]} offset={[0, -0.9, 0]} explode={explode}>
      <mesh castShadow>
        <cylinderGeometry args={[0.58, 0.68, 0.28, 36]} />
        <Metal color="#262e36" roughness={0.34} metalness={0.72} />
      </mesh>
      <mesh position={[0, -0.26, 0]}>
        <cylinderGeometry args={[0.36, 0.44, 0.35, 32]} />
        <Metal color="#d4d9d7" roughness={0.24} metalness={0.72} />
      </mesh>
      <mesh position={[0, -0.48, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.4, 18]} />
        <Metal color="#272e32" roughness={0.3} metalness={0.75} />
      </mesh>
      {[0.08, 0.18, 0.28].map(y => (
        <mesh key={y} position={[0, -y, 0]}>
          <torusGeometry args={[0.37 - y * 0.15, 0.018, 8, 28]} />
          <Metal color="#8c9b9d" roughness={0.3} metalness={0.76} />
        </mesh>
      ))}
    </MovingPart>
  );
}

function Callout({ label, detail, point, anchor, visible, tone = 'cyan' }) {
  if (!visible) return null;
  return (
    <>
      <Line points={[point, anchor]} color={tone === 'yellow' ? '#d9b632' : '#48d5de'} transparent opacity={0.72} lineWidth={1} />
      <Html position={anchor} distanceFactor={8} transform={false}>
        <div className={`argo-callout argo-callout--${tone}`}>
          <strong>{label}</strong>
          <span>{detail}</span>
        </div>
      </Html>
    </>
  );
}

function Hotspot({ label, detail, position, tone = 'cyan' }) {
  const [open, setOpen] = useState(false);
  return (
    <Html position={position} distanceFactor={8} transform={false} zIndexRange={[20, 0]}>
      <div
        className={`argo-hotspot argo-hotspot--${tone}${open ? ' is-open' : ''}`}
      >
        <button
          type="button"
          aria-label={`${label}: ${detail}`}
          aria-expanded={open}
          onPointerEnter={() => setOpen(true)}
          onPointerLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={() => setOpen(value => !value)}
        >
          <span aria-hidden="true" />
        </button>
        <div className="argo-hotspot__panel" role="status">
          <strong>{label}</strong>
          <span>{detail}</span>
        </div>
      </div>
    </Html>
  );
}

function FloatAssembly({ progress }) {
  const group = useRef();
  const explode = smoothstep(0.16, 0.48, progress) * (1 - smoothstep(0.78, 0.98, progress));
  const operation = smoothstep(0.62, 0.78, progress);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.16;
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, Math.sin(state.clock.elapsedTime * 0.32) * 0.035, 2, delta);
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, operation * 0.12, 3, delta);
  });

  return (
    <group ref={group} scale={0.72}>
      <Hull explode={explode} />
      <PressureCore explode={explode} />
      <TopAssembly explode={explode} />
      <StabilityDisk explode={explode} />
      <Electronics explode={explode} />
      <Battery explode={explode} />
      <BuoyancyEngine explode={explode} />
      <PumpAssembly explode={explode} />
      <Ballast explode={explode} />
      <LowerSensor explode={explode} />
      <Hotspot label="CTD sensor" detail="Conductivity, temperature and pressure observations." position={[0, 2.52, 0.08]} />
      <Hotspot label="Controller" detail="Runs the mission schedule and packages observations." position={[0.28, 1.42, 0.18]} />
      <Hotspot label="Buoyancy engine" detail="Moves mineral oil to change the float's volume." position={[0.62, -0.32, 0.18]} tone="yellow" />
      <Hotspot label="Lithium bay" detail="Primary power pack; capacity limits mission life." position={[-0.58, -0.78, 0.12]} tone="yellow" />
      <Hotspot label="External bladder" detail="Expands at the surface to create positive buoyancy." position={[0.72, -1.08, 0.18]} tone="yellow" />
      <Hotspot label="GPS + satellite" detail="Receives a surface fix and transmits the profile." position={[0, 3.42, 0.08]} />
    </group>
  );
}

function CameraRig({ progress }) {
  const { camera } = useThree();
  const explode = smoothstep(0.16, 0.48, progress) * (1 - smoothstep(0.78, 0.98, progress));
  useFrame((_, delta) => {
    const targetZ = THREE.MathUtils.lerp(10.8, 14.2, explode);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 4, delta);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, 5.4, 4, delta);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Scene({ progress }) {
  return (
    <Canvas camera={{ position: [5.4, 0.4, 10.8], fov: 36 }} dpr={[1, 1.7]} shadows gl={{ antialias: true, alpha: true }}>
      <color attach="background" args={['#071114']} />
      <ambientLight intensity={1.15} color="#b7e8ea" />
      <directionalLight position={[4, 6, 6]} intensity={4.5} color="#d9f8ff" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-5, 1, -3]} intensity={2.3} color="#1b9baa" />
      <pointLight position={[0, -2, 3]} intensity={2.2} distance={8} color="#1ee1e6" />
      <Stage adjustCamera={false} intensity={0.4} environment="city" shadows="contact">
        <FloatAssembly progress={progress} />
      </Stage>
      <CameraRig progress={progress} />
      <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
    </Canvas>
  );
}

export default function ArgoExplodedView() {
  const sectionRef = useRef(null);
  const interactionZoneRef = useRef(null);
  const scrollProgress = useScrollProgress(sectionRef);
  const localTarget = useRef(0);
  const [insideRadius, setInsideRadius] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);

  useEffect(() => {
    if (!insideRadius) return undefined;
    localTarget.current = scrollProgress;
    setLocalProgress(scrollProgress);
    let frame = 0;
    const settle = () => {
      setLocalProgress(current => {
        const next = current + (localTarget.current - current) * 0.14;
        if (Math.abs(next - localTarget.current) > 0.0005) frame = requestAnimationFrame(settle);
        else frame = 0;
        return next;
      });
    };
    frame = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(frame);
  }, [insideRadius, scrollProgress]);

  useEffect(() => {
    const zone = interactionZoneRef.current;
    if (!zone) return undefined;
    const onWheel = event => {
      if (!insideRadius) return;
      event.preventDefault();
      localTarget.current = clamp01(localTarget.current + event.deltaY / 1250);
    };
    zone.addEventListener('wheel', onWheel, { passive: false });
    return () => zone.removeEventListener('wheel', onWheel);
  }, [insideRadius]);

  const progress = insideRadius ? localProgress : scrollProgress;
  const stageIndex = Math.min(STAGES.length - 1, Math.floor(progress * STAGES.length));
  const stage = STAGES[stageIndex];
  const progressPercent = Math.round(progress * 100);
  const operation = progress > 0.64 && progress < 0.83;

  return (
    <section className="argo-story" ref={sectionRef} aria-labelledby="argo-story-title">
      <div className="argo-story__sticky">
        <div
          ref={interactionZoneRef}
          className={`argo-story__interaction-zone${insideRadius ? ' is-active' : ''}`}
          role="region"
          aria-label="3D model interaction radius. Hover here and scroll to explode the ARGO float."
          onPointerEnter={() => {
            localTarget.current = scrollProgress;
            setLocalProgress(scrollProgress);
            setInsideRadius(true);
          }}
          onPointerLeave={() => setInsideRadius(false)}
        >
          <span className="argo-story__interaction-label">{insideRadius ? 'Scroll to explode' : 'Hover to explore'}</span>
        </div>
        <div className="argo-story__canvas" aria-label="Interactive 3D exploded view of an ARGO profiling float">
          <Scene progress={progress} />
        </div>
        <div className="argo-story__copy">
          <p className="eyebrow argo-story__eyebrow">ARGO / SYSTEM STUDY / 01</p>
          <h2 id="argo-story-title">Inside the profile.</h2>
          <p className="argo-story__stage">{stage[0]}</p>
          <p className="argo-story__detail">{operation ? 'A typical core cycle parks near 1,000 m, descends toward 2,000 m, rises while the CTD samples, then surfaces for GPS and satellite telemetry.' : stage[1]}</p>
          <div className="argo-story__specs" aria-label="Core float baseline specifications">
            <div><strong>~1.5–2 m</strong><span>length</span></div>
            <div><strong>~20–30 kg</strong><span>mass</span></div>
            <div><strong>~10 days</strong><span>cycle</span></div>
            <div><strong>~2,000 m</strong><span>core profile</span></div>
          </div>
          <div className="argo-story__progress" aria-label={`Scroll progress ${progressPercent}%`}>
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>
          <p className="argo-story__hint">{insideRadius ? 'Scroll inside the radius · leave it to resume page scroll' : 'Hover the model radius · scroll to open the assembly'}</p>
        </div>
        <div className="argo-story__stage-count">{String(stageIndex + 1).padStart(2, '0')} / 06</div>
      </div>
    </section>
  );
}
