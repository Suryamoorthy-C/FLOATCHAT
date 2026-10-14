import React, { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  if (mode === 'suitability') {
    if (marker.status === 'promising') return '#f2bd59'
    if (marker.status === 'marginal' || marker.status === 'low-suitability') return '#ec7c69'
    return '#31d6bd'
  }
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

function GlobeMarker({ marker, radius, color, selected, onClick, screenSpaceLabels, portal, labelOffset = { x: 0, y: 0 } }) {
  const [hovered, setHovered] = useState(false)
  const { camera } = useThree()
  const anchorRef = useRef(null)
  const buttonRef = useRef(null)
  const projected = useMemo(() => new THREE.Vector3(), [])
  const [frontFacing, setFrontFacing] = useState(true)
  const [tooltipPlacement, setTooltipPlacement] = useState({ horizontal: 'right', vertical: 'center', maxWidth: 220 })
  const markerLat = marker.displayLat ?? marker.lat
  const markerLng = marker.displayLng ?? marker.lng
  const surface = useMemo(() => latLngToVector3(markerLat, markerLng, radius * 1.006), [markerLat, markerLng, radius])
  const top = useMemo(() => latLngToVector3(markerLat, markerLng, radius * (selected ? 1.22 : 1.14)), [markerLat, markerLng, radius, selected])
  const direction = useMemo(() => top.clone().sub(surface).normalize(), [surface, top])
  const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction), [direction])
  const lineCenter = useMemo(() => surface.clone().lerp(top, 0.5), [surface, top])
  const lineHeight = top.distanceTo(surface)
  const label = `${marker.id} · ${marker.region || 'ARGO float'}`
  const metric = `T ${marker.temp != null ? marker.temp.toFixed(1) : '—'}°C · S ${marker.sal != null ? marker.sal.toFixed(2) : '—'} PSU`
  const leaderLength = Math.hypot(labelOffset.x, labelOffset.y)
  const leaderAngle = Math.atan2(-labelOffset.y, -labelOffset.x)

  const updateTooltipPlacement = () => {
    if (!buttonRef.current) return
    const markerBox = buttonRef.current.getBoundingClientRect()
    const stageBox = buttonRef.current.closest('.pearl-globe-stage, .globe-3d-shell')?.getBoundingClientRect()
    const x = markerBox.left + markerBox.width / 2
    const y = markerBox.top + markerBox.height / 2
    const leftSpace = x - (stageBox?.left ?? 0) - 12
    const rightSpace = (stageBox?.right ?? window.innerWidth) - x - 12
    const horizontal = rightSpace >= leftSpace ? 'right' : 'left'
    const maxWidth = Math.max(120, Math.min(260, Math.floor(Math.max(leftSpace, rightSpace) - 20)))
    const preferredVertical = labelOffset.y < 0 ? 'above' : labelOffset.y > 0 ? 'below' : 'center'
    const vertical = y - (stageBox?.top ?? 0) < 64 ? 'below' : (stageBox?.bottom ?? window.innerHeight) - y < 64 ? 'above' : preferredVertical
    setTooltipPlacement((current) => (
      current.horizontal === horizontal && current.vertical === vertical && current.maxWidth === maxWidth
        ? current
        : { horizontal, vertical, maxWidth }
    ))
  }

  useFrame(() => {
    if (!screenSpaceLabels || !anchorRef.current) return
    anchorRef.current.getWorldPosition(projected)
    const isFrontFacing = projected.dot(camera.position) > 0
    setFrontFacing((current) => current === isFrontFacing ? current : isFrontFacing)
    if (isFrontFacing && hovered) updateTooltipPlacement()
  })

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
      <group ref={anchorRef} position={top}>
        <Html center transform={false} portal={screenSpaceLabels ? portal : undefined} style={{ pointerEvents: 'auto', overflow: 'visible', display: screenSpaceLabels && !frontFacing ? 'none' : 'block' }}>
          <button
            ref={buttonRef}
            type="button"
            className={'argo-marker' + (selected ? ' is-selected' : '') + (hovered ? ' is-hovered' : '') + (screenSpaceLabels ? ` argo-marker--${tooltipPlacement.horizontal} argo-marker--${tooltipPlacement.vertical}` : '') + (leaderLength ? ' argo-marker--fanned' : '')}
            style={{ '--marker-color': color, '--marker-tooltip-max-width': `${tooltipPlacement.maxWidth}px`, '--marker-label-offset-x': `${labelOffset.x}px`, '--marker-label-offset-y': `${labelOffset.y}px`, '--marker-leader-length': `${leaderLength}px`, '--marker-leader-angle': `${leaderAngle}rad` }}
            aria-label={`Select ${label}`}
            onPointerEnter={() => { setHovered(true); updateTooltipPlacement() }}
            onPointerLeave={() => setHovered(false)}
            onFocus={() => { setHovered(true); updateTooltipPlacement() }}
            onBlur={() => setHovered(false)}
            onClick={() => onClick(marker)}
          >
            {leaderLength > 0 && <span className="argo-marker__leader" aria-hidden="true" />}
            <span className="argo-marker__dot" />
            <span className="argo-marker__label"><b>{label}</b><small>{metric}{marker.anomaly ? ' · OUTLIER' : ''}</small></span>
          </button>
        </Html>
      </group>
    </group>
  )
}

function GlobeScene({ markers, path, mode, selectedId, rotating, rotationSpeed, showGraticules, centerLongitude, onMarkerClick, screenSpaceLabels, portal }) {
  const group = useRef(null)
  const { camera } = useThree()
  const [earth, bump] = useTexture([EARTH_TEXTURE, BUMP_TEXTURE])

  useEffect(() => {
    earth.colorSpace = THREE.SRGBColorSpace
    earth.anisotropy = 8
    bump.anisotropy = 4
  }, [earth, bump])

  useEffect(() => {
    camera.position.set(0, 0, 5.8)
    camera.lookAt(0, 0, 0)
  }, [camera])

  useFrame(() => {
    if (group.current && rotating) group.current.rotation.y += rotationSpeed
  })

  const focus = markers.find((marker) => marker.id === selectedId)
  const visiblePath = path?.length > 1 ? path : []
  const markerColumns = Math.ceil(Math.sqrt(markers.length))
  const markerRows = Math.ceil(markers.length / markerColumns)

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[8, 4, 8]} intensity={1.7} />
      <directionalLight position={[-5, 2, -4]} intensity={0.45} color="#6bc9ff" />
      <group ref={group} rotation={[0.05, (-90 - centerLongitude) * Math.PI / 180, 0]}>
        <mesh>
          <sphereGeometry args={[2, 64, 64]} />
          <meshStandardMaterial map={earth} bumpMap={bump} bumpScale={0.08} roughness={0.82} metalness={0.02} />
        </mesh>
        {showGraticules && <mesh scale={[1.004, 1.004, 1.004]}>
          <sphereGeometry args={[2, 32, 18]} />
          <meshBasicMaterial color="#67e8f9" wireframe transparent opacity={0.09} />
        </mesh>}
        {markers.map((marker, index) => {
          const labelOffset = screenSpaceLabels && markers.length > 1
            ? {
                x: (index % markerColumns - (markerColumns - 1) / 2) * 34,
                y: (Math.floor(index / markerColumns) - (markerRows - 1) / 2) * 34,
              }
            : { x: 0, y: 0 }
          return (
            <GlobeMarker
              key={marker.id}
              marker={marker}
              radius={2}
              color={markerColor(marker, mode)}
              selected={focus?.id === marker.id}
              onClick={onMarkerClick}
              screenSpaceLabels={screenSpaceLabels}
              portal={portal}
              labelOffset={labelOffset}
            />
          )
        })}
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
      <OrbitControls makeDefault enablePan={false} enableZoom minDistance={4.2} maxDistance={8.5} rotateSpeed={0.45} enableDamping dampingFactor={0.08} />
    </>
  )
}

function LoadingGlobe() {
  return <mesh>
    <sphereGeometry args={[1.2, 24, 16]} />
    <meshBasicMaterial color="#2de2d2" wireframe transparent opacity={0.24} />
  </mesh>
}

export default function Globe3D({ markers = [], path = [], mode = 'telemetry', selectedId, rotating = true, rotationSpeed = 0.0008, showGraticules = true, centerLongitude = -61.35, onMarkerClick, screenSpaceLabels = false, pixelRatio = 1.5 }) {
  const portal = useRef(null)
  const [portalReady, setPortalReady] = useState(false)
  useLayoutEffect(() => {
    setPortalReady(Boolean(portal.current))
  }, [])

  return (
    <div className="globe-3d-shell">
      {portalReady && <Canvas
        dpr={[1, pixelRatio]}
        camera={{ fov: 42, near: 0.1, far: 100, position: [0, 0, 5.8] }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={<LoadingGlobe />}>
          <GlobeScene markers={markers} path={path} mode={mode} selectedId={selectedId} rotating={rotating} rotationSpeed={rotationSpeed} showGraticules={showGraticules} centerLongitude={centerLongitude} onMarkerClick={onMarkerClick} screenSpaceLabels={screenSpaceLabels} portal={portal} />
        </Suspense>
      </Canvas>}
      <div ref={portal} className="globe-3d-html-layer" style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 2 }} />
    </div>
  )
}
