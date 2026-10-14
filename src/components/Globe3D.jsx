import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, useTexture } from '@react-three/drei'
import * as THREE from 'three'

const EARTH_TEXTURE = 'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg'
const BUMP_TEXTURE = 'https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png'

function latLngToVector3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

function markerColor(marker, mode) {
  if (mode === 'salinity') return marker.anomaly ? '#ffc857' : '#00e5ff'
  if (mode === 'spectral') return marker.temp > 28 ? '#ff5577' : marker.temp > 24 ? '#ffd166' : '#4e9cf5'
  return marker.anomaly ? '#8ff7ff' : '#00f2fe'
}

function Atmosphere({ radius = 2, color = '#00e5ff' }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(color) } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        float fresnel = pow(1.0 - abs(dot(vNormal, normalize(-vPosition))), 2.5);
        gl_FragColor = vec4(glowColor, fresnel * 0.9);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  }), [color])

  useEffect(() => () => material.dispose(), [material])
  return <mesh scale={[1.13, 1.13, 1.13]}><sphereGeometry args={[radius, 64, 32]} /><primitive object={material} attach="material" /></mesh>
}

function GlobeMarker({ marker, radius, color, selected, onClick }) {
  const [hovered, setHovered] = useState(false)
  const surface = useMemo(() => latLngToVector3(marker.lat, marker.lng, radius * 1.006), [marker.lat, marker.lng, radius])
  const top = useMemo(() => latLngToVector3(marker.lat, marker.lng, radius * (selected ? 1.22 : 1.14)), [marker.lat, marker.lng, radius, selected])
  const direction = useMemo(() => top.clone().sub(surface).normalize(), [surface, top])
  const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction), [direction])
  const lineCenter = useMemo(() => surface.clone().lerp(top, 0.5), [surface, top])
  const lineHeight = top.distanceTo(surface)
  const label = `${marker.id} · ${marker.region || 'ARGO float'}`
  const metric = `T ${marker.temp != null ? marker.temp.toFixed(1) : '—'}°C · S ${marker.sal != null ? marker.sal.toFixed(2) : '—'} PSU`

  return (
    <group>
      <mesh position={lineCenter} quaternion={quaternion}>
        <cylinderGeometry args={[selected ? 0.009 : 0.004, selected ? 0.009 : 0.004, lineHeight, 8]} />
        <meshBasicMaterial color={hovered || selected ? '#ffffff' : color} transparent opacity={selected ? 0.95 : 0.68} />
      </mesh>
      <mesh position={surface}>
        <sphereGeometry args={[selected ? 0.035 : 0.022, 12, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <group position={top}>
        <Html transform center sprite distanceFactor={8} occlude>
          <button
            type="button"
            className={'argo-marker' + (selected ? ' is-selected' : '') + (hovered ? ' is-hovered' : '')}
            style={{ '--marker-color': color }}
            aria-label={`Select ${label}`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => onClick(marker)}
          >
            <span className="argo-marker__dot" />
            <span className="argo-marker__label"><b>{label}</b><small>{metric}{marker.anomaly ? ' · OUTLIER' : ''}</small></span>
          </button>
        </Html>
      </group>
    </group>
  )
}

function GlobeScene({ markers, path, mode, selectedId, rotating, onMarkerClick }) {
  const group = useRef(null)
  const { camera } = useThree()
  const [earth, bump] = useTexture([EARTH_TEXTURE, BUMP_TEXTURE])

  useEffect(() => {
    earth.colorSpace = THREE.SRGBColorSpace
    earth.anisotropy = 8
    bump.anisotropy = 4
  }, [earth, bump])

  useEffect(() => {
    camera.position.set(0, 0, 7)
    camera.lookAt(0, 0, 0)
  }, [camera])

  useFrame(() => {
    if (group.current && rotating) group.current.rotation.y += 0.0008
  })

  const focus = markers.find((marker) => marker.id === selectedId)
  const visiblePath = path?.length > 1 ? path : []

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[8, 4, 8]} intensity={1.7} />
      <directionalLight position={[-5, 2, -4]} intensity={0.45} color="#6bc9ff" />
      <group ref={group} rotation={[0.05, -0.5, 0]}>
        <mesh>
          <sphereGeometry args={[2, 64, 64]} />
          <meshStandardMaterial map={earth} bumpMap={bump} bumpScale={0.08} roughness={0.82} metalness={0.02} />
        </mesh>
        <mesh scale={[1.004, 1.004, 1.004]}>
          <sphereGeometry args={[2, 32, 18]} />
          <meshBasicMaterial color="#67e8f9" wireframe transparent opacity={0.09} />
        </mesh>
        {markers.map((marker) => (
          <GlobeMarker
            key={marker.id}
            marker={marker}
            radius={2}
            color={markerColor(marker, mode)}
            selected={focus?.id === marker.id}
            onClick={onMarkerClick}
          />
        ))}
        {visiblePath.map((point, index) => {
          if (index === 0) return null
          const a = latLngToVector3(visiblePath[index - 1][0], visiblePath[index - 1][1], 2.018)
          const b = latLngToVector3(point[0], point[1], 2.018)
          const mid = a.clone().lerp(b, 0.5)
          const segment = b.clone().sub(a)
          const segmentLength = segment.length()
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), segment.normalize())
          return <mesh key={`path-${index}`} position={mid} quaternion={q}><cylinderGeometry args={[0.012, 0.012, segmentLength, 6]} /><meshBasicMaterial color="#ffc857" transparent opacity={0.8} /></mesh>
        })}
      </group>
      <Atmosphere />
      <OrbitControls makeDefault enablePan={false} enableZoom minDistance={4.8} maxDistance={10} rotateSpeed={0.45} enableDamping dampingFactor={0.08} />
    </>
  )
}

function LoadingGlobe() {
  return <Html center><div className="globe-loading">INITIALIZING ARGO SPHERE…</div></Html>
}

export default function Globe3D({ markers = [], path = [], mode = 'telemetry', selectedId, rotating = true, onMarkerClick }) {
  return (
    <div className="globe-3d-shell">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ fov: 42, near: 0.1, far: 100, position: [0, 0, 7] }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={<LoadingGlobe />}>
          <GlobeScene markers={markers} path={path} mode={mode} selectedId={selectedId} rotating={rotating} onMarkerClick={onMarkerClick} />
        </Suspense>
      </Canvas>
    </div>
  )
}
