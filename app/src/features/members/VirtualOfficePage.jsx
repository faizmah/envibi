import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { useAuth } from '../../app/providers/AuthProvider'
import { formatRupiah } from '../../utils/format'

export default function VirtualOfficePage() {
  const containerRef = useRef(null)
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  // HUD States
  const [activeStaffCount, setActiveStaffCount] = useState(0)
  const [activeTasksCount, setActiveTasksCount] = useState(0)
  const [waitingQueueCount, setWaitingQueueCount] = useState(0)
  const [simMonth, setSimMonth] = useState(1)
  const [dockOpenMenu, setDockOpenMenu] = useState(null)
  const [activeFloor, setActiveFloor] = useState('all')
  const [camMode, setCamMode] = useState('orbit')
  const [hasFloor4, setHasFloor4] = useState(false)
  const [showMemberModal, setShowMemberModal] = useState(false)

  // Simulation controls state
  const [serviceType, setServiceType] = useState('Setoran')
  const [serviceAmount, setServiceAmount] = useState(500000)

  // References for three.js loop & dispatch
  const threeRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const W = 20, D = 10, Z0 = -12
    const mkGrid = () => Array.from({ length: D - Z0 }, () => Array(W).fill(false))
    let blocked = mkGrid()
    const grids = { 1: blocked, 2: mkGrid(), 3: mkGrid(), 4: mkGrid() }
    const setB = (x, z) => { if (x >= 0 && x < W && z >= Z0 && z < D) blocked[z - Z0][x] = true }
    const setBF = (f, x, z) => { if (x >= 0 && x < W && z >= Z0 && z < D) grids[f][z - Z0][x] = true }

    const isMobile = window.innerWidth < 700
    const PR = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: false })
    renderer.setPixelRatio(PR)
    renderer.setSize(window.innerWidth, window.innerHeight)
    container.appendChild(renderer.domElement)
    const cv = renderer.domElement

    // Scene & Camera
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x17212d)
    const cam = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000)

    // Lights
    scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x59616d, 1.1))
    const sun = new THREE.DirectionalLight(0xffe5bd, 0.85)
    sun.position.set(5, 14, 8)
    scene.add(sun)

    // Textures & Materials
    const pix = (n, draw, rx = 1, ry = 1) => {
      const c = document.createElement('canvas')
      c.width = c.height = n
      draw(c.getContext('2d'))
      const t = new THREE.CanvasTexture(c)
      t.magFilter = t.minFilter = THREE.NearestFilter
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(rx, ry)
      return t
    }
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c })
    const box = (w, h, d, m, x, y, z, p = scene) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
      o.position.set(x, y, z)
      p.add(o)
      return o
    }
    const textPlane = (txt, w, h, bg, x, y, z, P = scene) => {
      const c = document.createElement('canvas')
      c.width = 512
      c.height = 128
      const g = c.getContext('2d')
      g.fillStyle = bg
      g.fillRect(0, 0, c.width, c.height)
      g.fillStyle = '#fff'
      g.font = 'bold 38px sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(txt, 256, 64)
      const t = new THREE.CanvasTexture(c)
      t.magFilter = THREE.LinearFilter
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true }))
      m.position.set(x, y, z)
      P.add(m)
      return m
    }

    const floorMat = new THREE.MeshLambertMaterial({
      map: pix(2, (g) => {
        g.fillStyle = '#4b5661'
        g.fillRect(0, 0, 2, 2)
        g.fillStyle = '#56616c'
        g.fillRect(0, 0, 1, 1)
        g.fillRect(1, 1, 1, 1)
      }, W / 2, 11),
    })

    // Floor 1 base
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, 22), floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(10, 0, -1)
    scene.add(floor)

    const wall = mat('#263544'), trim = mat('#b38a50'), wood = mat('#795d43'), dark = mat('#26313c'), glass = mat('#7295a8'), seat = mat('#526c7b')

    // Perimeter walls
    box(20, 0.22, 0.35, wall, 10, 0.11, -12)
    box(20, 0.22, 0.35, wall, 10, 0.11, 10)
    box(0.3, 1, 22, wall, -0.15, 0.5, -1)
    box(0.3, 1, 22, wall, 20.15, 0.5, -1)
    box(20, 0.12, 0.18, trim, 10, 0.08, 0)
    box(0.18, 0.12, 12, trim, 10, 0.08, -6)

    // Signage
    box(8, 1.1, 0.18, mat('#142331'), 10, 2.15, -11.72)
    textPlane('NARAYAN VIRTUAL BANK', 7.5, 0.72, '#142331', 10, 2.18, -11.60)
    textPlane('CUSTOMER LOBBY', 4, 0.5, '#344b5b', 10, 1.85, 9.55)
    textPlane('CUSTOMER SERVICE', 4, 0.5, '#344b5b', 5, 1.8, -2.25)
    textPlane('BRANKAS KAS', 2, 0.4, '#344b5b', 10, 1.75, -11.2)
    textPlane('TELLER SERVICE', 2, 0.45, '#344b5b', 14, 1.7, 2.55)

    const counter = (x, z, w, label) => {
      box(w, 0.72, 0.85, wood, x, 0.36, z)
      box(w, 0.12, 0.88, trim, x, 0.78, z)
      box(0.42, 0.28, 0.06, dark, x, 0.98, z - 0.2)
      textPlane(label, Math.max(1.4, w - 0.2), 0.28, '#344b5b', x, 1.24, z + 0.48)
    }
    counter(5, 6, 3, 'RESEPSIONIS')
    counter(5, -3, 3, 'CUSTOMER SERVICE')
    counter(13, 3, 5, 'TELLER SERVICE')

    const officeDesk = (x, z, label, P = scene) => {
      box(1.9, 0.62, 0.82, wood, x, 0.31, z, P)
      box(0.5, 0.32, 0.06, dark, x, 0.82, z - 0.2, P)
      box(0.44, 0.24, 0.025, glass, x, 0.83, z - 0.24, P)
      textPlane(label, 1.8, 0.26, '#344b5b', x, 1.12, z + 0.46, P)
    }

    // Multi-floor Setup (Floors 1, 2, 3)
    const FH = 4.2
    const fl = { 1: scene, 2: new THREE.Group(), 3: new THREE.Group(), 4: new THREE.Group() }
    fl[2].position.y = FH
    fl[3].position.y = FH * 2
    fl[4].position.y = FH * 3
    scene.add(fl[2], fl[3], fl[4])
    fl[4].visible = false

    const glassT = new THREE.MeshLambertMaterial({ color: '#7fb3c8', transparent: true, opacity: 0.28, depthWrite: false })
    const slabM = new THREE.MeshLambertMaterial({ map: floorMat.map, transparent: true, opacity: 0.5, depthWrite: false })

    const mkFloorMesh = (f, title) => {
      const g = fl[f]
      const p = new THREE.Mesh(new THREE.PlaneGeometry(W, 22), slabM)
      p.rotation.x = -Math.PI / 2
      p.position.set(10, 0.01, -1)
      g.add(p)
      box(20, 0.22, 0.35, wall, 10, 0.11, -12, g)
      box(20, 0.22, 0.35, wall, 10, 0.11, 10, g)
      box(0.3, 1, 22, wall, -0.15, 0.5, -1, g)
      box(0.3, 1, 22, wall, 20.15, 0.5, -1, g)
      box(8, 1.1, 0.18, mat('#142331'), 10, 2.15, -11.72, g)
      textPlane(title, 7.5, 0.62, '#142331', 10, 2.18, -11.6, g)
    }

    mkFloorMesh(2, 'LANTAI 2 · OPERATIONAL MANAGEMENT')
    mkFloorMesh(3, 'LANTAI 3 · DIGITAL BANKING & SERVER')
    mkFloorMesh(4, 'LANTAI 4 · PRODUCT & WEALTH CENTER')

    // Elevators
    for (const f of [1, 2, 3, 4]) {
      box(0.9, 0.02, 0.9, trim, 18.5, 0.02, 8.5, fl[f])
      textPlane('LIFT', 1.1, 0.28, '#344b5b', 18.5, 1.5, 9.65, fl[f])
    }
    const cabin = box(1, 2.2, 1, new THREE.MeshLambertMaterial({ color: '#9fb7c4', transparent: true, opacity: 0.3, depthWrite: false }), 18.5, 1.1, 8.5)

    // Floor 1 seating & Vault
    for (const [x, z] of [[9, 7], [10, 7], [11, 7], [9, 8], [10, 8], [11, 8]]) {
      box(0.85, 0.2, 0.6, seat, x + 0.5, 0.2, z + 0.5)
      box(0.85, 0.42, 0.1, seat, x + 0.5, 0.5, z + 0.78)
    }
    box(2.4, 1.5, 0.3, mat('#4b5661'), 10, 0.75, -11.5)
    box(0.5, 0.5, 0.1, trim, 10, 0.8, -11.3)

    // Floor 2 desks
    const g2 = fl[2], g3 = fl[3]
    officeDesk(3, -8, 'KEPALA OPERASIONAL', g2)
    officeDesk(8, -8, 'VERIFIKASI', g2)
    officeDesk(18, -3, 'AUDIT', g2)
    box(3, 0.5, 1.4, wood, 10.5, 0.25, -2.5, g2)
    textPlane('RUANG RAPAT', 2, 0.3, '#344b5b', 10.5, 1.1, -1.7, g2)
    box(6, 1.6, 0.05, glassT, 16, 0.8, -6.5, g2)
    box(0.05, 1.6, 4.5, glassT, 13, 0.8, -9, g2)
    officeDesk(16, -9, 'OWNER', g2)
    const ownerLamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshBasicMaterial({ color: 0x2ecc71 }))
    ownerLamp.position.set(16, 1.5, -9)
    g2.add(ownerLamp)

    // Floor 3 Digital
    officeDesk(3, -8, 'KEAMANAN', g3)
    officeDesk(7, -8, 'DATA NASABAH', g3)
    officeDesk(12, -8, 'TRANSFER DIGITAL', g3)
    officeDesk(16, -8, 'KEUANGAN', g3)
    const leds = []
    for (let i = 0; i < 4; i++) {
      const x = 1.2 + i * 0.9
      box(0.75, 1.9, 0.8, dark, x, 0.95, -10.6, g3)
      for (let k = 0; k < 3; k++) {
        leds.push(box(0.5, 0.06, 0.02, new THREE.MeshBasicMaterial({ color: k % 2 ? 0x2ecc71 : 0x4aa3ff }), x, 0.6 + k * 0.45, -10.18, g3))
      }
    }
    textPlane('RUANG SERVER', 2.8, 0.3, '#344b5b', 2.7, 2.15, -10.1, g3)

    // Characters definition
    const chars = []
    const makeChar = (o) => {
      const g = new THREE.Group()
      const skin = mat(o.skin), hair = mat(o.hair), shirt = mat(o.shirt), pants = mat(o.pants)
      const ft = pix(8, (c) => {
        const r = (x, y, w, h, f) => { c.fillStyle = f; c.fillRect(x, y, w, h) }
        r(0, 0, 8, 8, o.skin)
        r(0, 0, 8, 2, o.hair)
        r(1, 3, 2, 2, '#2b2b3a')
        r(5, 3, 2, 2, '#2b2b3a')
        r(1, 3, 1, 1, '#fff')
        r(5, 3, 1, 1, '#fff')
        r(0, 5, 1, 1, '#ff9aa8')
        r(7, 5, 1, 1, '#ff9aa8')
        r(3, 6, 2, 1, '#c0392b')
      })
      const hg = new THREE.Group()
      hg.position.y = 1.15
      g.add(hg)
      hg.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), [skin, skin, hair, skin, new THREE.MeshLambertMaterial({ map: ft }), hair]))
      box(0.76, 0.14, 0.76, hair, 0, 0.39, 0, hg)
      box(0.5, 0.5, 0.32, shirt, 0, 0.55, 0, g)

      const limb = (px, py, top, low, h) => {
        const p = new THREE.Group()
        p.position.set(px, py, 0)
        box(0.16, h * 0.7, 0.16, top, 0, -h * 0.35, 0, p)
        box(0.16, h * 0.3, 0.16, low, 0, -h * 0.85, 0, p)
        g.add(p)
        return p
      }

      const holdG = new THREE.Group()
      holdG.position.set(0, 0.62, 0.4)
      g.add(holdG)

      const bubEl = document.createElement('div')
      bubEl.className = 'bub'
      bubEl.style.display = 'none'
      container.appendChild(bubEl)

      let tagEl = null
      if (o.name) {
        tagEl = document.createElement('div')
        tagEl.className = 'tag'
        tagEl.style.background = o.shirt
        tagEl.textContent = `${o.name} · ${o.label}`
        container.appendChild(tagEl)
      }

      const c = {
        g, hg, holdG,
        armL: limb(-0.33, 0.78, shirt, skin, 0.4),
        armR: limb(0.33, 0.78, shirt, skin, 0.4),
        legL: limb(-0.12, 0.3, pants, pants, 0.3),
        legR: limb(0.12, 0.3, pants, pants, 0.3),
        path: [], res: null, amp: 0, rot: 0, f: 1, by: 0,
        ph: Math.random() * 6, held: null, busy: false,
        role: o.role, name: o.name, home: o.home,
        bub: bubEl, tag: tagEl,
      }
      scene.add(g)
      chars.push(c)
      return c
    }

    const staffList = [
      makeChar({ name: 'Sari', label: 'Resepsionis', role: 'reception', skin: '#f5cba7', hair: '#6e2c00', shirt: '#287d72', pants: '#263544', home: [7, 7] }),
      makeChar({ name: 'Budi', label: 'Customer Service', role: 'cs', skin: '#e0ac69', hair: '#222222', shirt: '#347da0', pants: '#263544', home: [7, -2] }),
      makeChar({ name: 'Dodi', label: 'Teller', role: 'teller', skin: '#c68642', hair: '#3b2f2f', shirt: '#a66b38', pants: '#34495e', home: [12, 4] }),
      makeChar({ name: 'Pak Rudi', label: 'Kepala Operasional', role: 'ops', skin: '#e0ac69', hair: '#999999', shirt: '#6c3483', pants: '#2c3e50', home: [2, -7] }),
      makeChar({ name: 'Dina', label: 'Verifikasi', role: 'verify', skin: '#f5cba7', hair: '#7d3c98', shirt: '#8e6bb0', pants: '#2d3436', home: [7, -7] }),
      makeChar({ name: 'Eko', label: 'Transfer Officer', role: 'transfer', skin: '#c68642', hair: '#222222', shirt: '#287d72', pants: '#2d3436', home: [11, -7] }),
      makeChar({ name: 'Rina', label: 'Finance Officer', role: 'finance', skin: '#f5cba7', hair: '#3b2f2f', shirt: '#b7950b', pants: '#2c3e50', home: [15, -7] }),
      makeChar({ name: 'Joko', label: 'Auditor', role: 'auditor', skin: '#8d5524', hair: '#222222', shirt: '#566b7b', pants: '#34495e', home: [18, -2] }),
    ]

    const STAFF_FLOOR = { ops: 2, verify: 2, auditor: 2, transfer: 3, finance: 3 }
    staffList.forEach((s) => {
      s.f = STAFF_FLOOR[s.role] || 1
      s.by = FH * (s.f - 1)
      s.g.position.set(s.home[0] + 0.5, s.by, s.home[1] + 0.5)
    })

    // Camera control variables
    const goal = { az: 0.3, el: 0.85, size: 38, tx: 10, tz: -1, fov: 50, ty: FH + 0.8 }
    const cur = { ...goal }
    const placeCam = (dt) => {
      const k = Math.min(1, dt * 8)
      for (const key in goal) cur[key] += (goal[key] - cur[key]) * k
      cam.fov = cur.fov
      cam.updateProjectionMatrix()
      const dist = (cur.size * Math.tan((25 * Math.PI) / 180)) / Math.tan((cur.fov * Math.PI) / 360)
      cam.position.set(
        cur.tx + dist * Math.cos(cur.el) * Math.sin(cur.az),
        cur.ty + dist * Math.sin(cur.el),
        cur.tz + dist * Math.cos(cur.el) * Math.cos(cur.az)
      )
      cam.lookAt(cur.tx, cur.ty, cur.tz)
    }

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
    const orbit = (dx, dy) => {
      goal.az -= dx * 0.006
      goal.el = clamp(goal.el + dy * 0.006, 0.08, 1.52)
    }
    const pan = (dx, dy) => {
      const s = goal.size * 0.0022, sa = Math.sin(goal.az), ca = Math.cos(goal.az)
      goal.tx = clamp(goal.tx - ca * dx * s - sa * dy * s, 0, 44)
      goal.tz = clamp(goal.tz + sa * dx * s - ca * dy * s, Z0, D)
    }

    // Pointer events
    const ptr = new Map()
    let currentTool = 'orbit'

    const handlePointerDown = (e) => {
      cv.setPointerCapture(e.pointerId)
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button })
    }
    const handlePointerMove = (e) => {
      const p = ptr.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x, dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      const mode = p.b === 1 ? (e.shiftKey ? 'pan' : 'orbit') : currentTool
      if (mode === 'pan') pan(dx, dy)
      else orbit(dx, dy)
    }
    const handlePointerUp = (e) => ptr.delete(e.pointerId)
    const handleWheel = (e) => {
      e.preventDefault()
      goal.size = clamp(goal.size * (e.deltaY > 0 ? 1.1 : 1 / 1.1), 5, 60)
    }

    cv.addEventListener('pointerdown', handlePointerDown)
    cv.addEventListener('pointermove', handlePointerMove)
    cv.addEventListener('pointerup', handlePointerUp)
    cv.addEventListener('wheel', handleWheel, { passive: false })

    // Resize
    const handleResize = () => {
      renderer.setPixelRatio(PR)
      renderer.setSize(window.innerWidth, window.innerHeight)
      cam.aspect = window.innerWidth / window.innerHeight
      cam.updateProjectionMatrix()
    }
    window.addEventListener('resize', handleResize)

    // Animation Loop
    let animId
    const clock = new THREE.Clock()
    const projV = new THREE.Vector3()

    const labelPos = (div, x, y, z, dy) => {
      projV.set(x, y, z).project(cam)
      if (projV.z > 1) {
        div.style.visibility = 'hidden'
        return
      }
      div.style.visibility = 'visible'
      div.style.transform = `translate(${(projV.x * 0.5 + 0.5) * window.innerWidth}px, ${(-projV.y * 0.5 + 0.5) * window.innerHeight + dy}px) translate(-50%, -100%)`
    }

    let viewMode = 'all'
    const loop = () => {
      animId = requestAnimationFrame(loop)
      const dt = Math.min(clock.getDelta(), 0.05)
      const t = clock.elapsedTime

      // Update characters
      for (const c of chars) {
        const p = c.g.position
        const show = viewMode === 'all' || (c.f || 1) <= (viewMode === 'all' ? 4 : Number(viewMode))
        c.g.visible = show

        // idle arm swing
        const sw = Math.sin(t * 3 + c.ph) * 0.2
        c.armL.rotation.x = sw
        c.armR.rotation.x = -sw

        // Label update
        if (c.tag) {
          if (!show) c.tag.style.visibility = 'hidden'
          else labelPos(c.tag, p.x, p.y + 1.85, p.z, 0)
        }
      }

      // Blink leds
      leds.forEach((l, i) => {
        l.visible = Math.sin(t * 6 + i * 1.7) > -0.3
      })

      placeCam(dt)
      renderer.render(scene, cam)
    }
    loop()

    // Store refs for external trigger
    threeRef.current = {
      setFloor: (mode) => {
        viewMode = mode
        fl[2].visible = mode === 'all' || Number(mode) >= 2
        fl[3].visible = mode === 'all' || Number(mode) >= 3
        fl[4].visible = mode === 'all' || Number(mode) >= 4
        goal.ty = (mode === 'all' ? FH : FH * (Number(mode) - 1)) + 0.8
        goal.size = mode === 'all' ? 38 : 27
      },
      setView: (v) => {
        const views = { top: [0, 1.52], front: [0, 0.1], left: [-Math.PI / 2, 0.1], iso: [0.8, 0.6] }
        if (views[v]) {
          goal.az = views[v][0]
          goal.el = views[v][1]
          goal.size = v === 'top' ? 34 : 27
        }
      },
      setTool: (tool) => {
        currentTool = tool
      },
      spawnCustomerSim: (type, amt) => {
        setActiveTasksCount((c) => c + 1)
        setActiveStaffCount((s) => Math.min(8, s + 1))
        setTimeout(() => {
          setActiveTasksCount((c) => Math.max(0, c - 1))
          setActiveStaffCount((s) => Math.max(0, s - 1))
        }, 5000)
      },
    }

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
      cv.removeEventListener('pointerdown', handlePointerDown)
      cv.removeEventListener('pointermove', handlePointerMove)
      cv.removeEventListener('pointerup', handlePointerUp)
      cv.removeEventListener('wheel', handleWheel)
      chars.forEach((c) => {
        c.bub?.remove()
        c.tag?.remove()
      })
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }, [])

  const handleFloorSelect = (f) => {
    setActiveFloor(f)
    threeRef.current?.setFloor(f)
    setDockOpenMenu(null)
  }

  const handleCamSelect = (v) => {
    threeRef.current?.setView(v)
    setDockOpenMenu(null)
  }

  const handleSpawnCustomer = () => {
    threeRef.current?.spawnCustomerSim(serviceType, serviceAmount)
    setDockOpenMenu(null)
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 3D Canvas Container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />

      {/* Top HUD */}
      <div id="hud">
        <div className="glass brand">
          <span className="logo">N</span>
          NARAYAN <small>3D VIRTUAL BRANCH</small>
        </div>
        <div className="glass chip">
          <span>Staf aktif:</span> <b>{activeStaffCount} / 8</b>
        </div>
        <div className="glass chip">
          <span>Tugas:</span> <b>{activeTasksCount}</b>
        </div>
        <div className="glass chip">
          <span>Bulan simulasi:</span> <b>{simMonth}</b>
        </div>
      </div>

      {/* Floating Launch Member Portal Button */}
      <button
        id="memberLaunch"
        type="button"
        onClick={() => {
          if (user) {
            navigate('/dashboard')
          } else {
            setShowMemberModal(true)
          }
        }}
      >
        <span>🏦</span> {user ? 'Dashboard Member' : 'Member Portal'}
      </button>

      {/* Bottom Dock Navigation */}
      <nav id="dock" className="glass">
        {/* Operasional */}
        <div className={`item ${dockOpenMenu === 'ops' ? 'open' : ''}`}>
          <button
            className="dbtn"
            onClick={() => setDockOpenMenu(dockOpenMenu === 'ops' ? null : 'ops')}
          >
            <span className="ic">🏦</span> Operasional
          </button>
          <div className="pop glass">
            <h5>Permintaan Layanan</h5>
            <label className="form-label">Jenis Layanan</label>
            <select
              className="field"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
            >
              <option value="Setoran">Setoran Tabungan</option>
              <option value="Penarikan">Penarikan Tabungan</option>
              <option value="Transfer">Transfer Rekening</option>
              <option value="Pembukaan rekening">Pembukaan Rekening Baru</option>
              <option value="Konsultasi">Konsultasi Bank</option>
            </select>
            <label className="form-label">Nominal (Rp)</label>
            <input
              type="number"
              className="field"
              value={serviceAmount}
              onChange={(e) => setServiceAmount(Number(e.target.value))}
              step="50000"
            />
            <div className="row" style={{ marginTop: '8px' }}>
              <button className="mb pri full" onClick={handleSpawnCustomer}>
                ＋ Datangkan Nasabah 3D
              </button>
            </div>
            <h5>Akses Cepat</h5>
            <div className="row">
              <Link to="/deposit" className="mb full">📥 Lapor Setor Mandiri</Link>
              <Link to="/withdrawal" className="mb full">📤 Lapor Tarik Mandiri</Link>
              <Link to="/box/activate" className="mb full">📦 Aktivasi Kotak NFC</Link>
            </div>
          </div>
        </div>

        {/* Lantai */}
        <div className={`item ${dockOpenMenu === 'floor' ? 'open' : ''}`}>
          <button
            className="dbtn"
            onClick={() => setDockOpenMenu(dockOpenMenu === 'floor' ? null : 'floor')}
          >
            <span className="ic">🏢</span> Lantai
          </button>
          <div className="pop glass">
            <h5>Tampilkan Lantai</h5>
            <div className="row">
              {['all', '1', '2', '3'].map((f) => (
                <button
                  key={f}
                  className={`mb ${activeFloor === f ? 'on' : ''}`}
                  onClick={() => handleFloorSelect(f)}
                >
                  {f === 'all' ? 'Semua' : `L${f}`}
                </button>
              ))}
            </div>
            <ul className="help" style={{ marginTop: '8px' }}>
              <li>L1: Customer Lobby & Teller</li>
              <li>L2: Operasional & Owner Room</li>
              <li>L3: Digital Banking & Server</li>
            </ul>
          </div>
        </div>

        {/* Kamera */}
        <div className={`item ${dockOpenMenu === 'cam' ? 'open' : ''}`}>
          <button
            className="dbtn"
            onClick={() => setDockOpenMenu(dockOpenMenu === 'cam' ? null : 'cam')}
          >
            <span className="ic">🎥</span> Kamera
          </button>
          <div className="pop glass">
            <h5>Sudut Pandang</h5>
            <div className="row">
              <button className="mb" onClick={() => handleCamSelect('top')}>Atas</button>
              <button className="mb" onClick={() => handleCamSelect('front')}>Depan</button>
              <button className="mb" onClick={() => handleCamSelect('left')}>Kiri</button>
              <button className="mb" onClick={() => handleCamSelect('iso')}>Iso</button>
            </div>
            <h5>Interaksi</h5>
            <ul className="help">
              <li>Orbit: Geser kursor / sentuh</li>
              <li>Zoom: Scroll / Cubit layar</li>
            </ul>
          </div>
        </div>

        {/* Dashboard Link */}
        <div className="item">
          <Link to="/dashboard" className="dbtn" style={{ textDecoration: 'none' }}>
            <span className="ic">📊</span> Dashboard
          </Link>
        </div>
      </nav>

      {/* Guest Member Modal */}
      {showMemberModal && (
        <div className="member-portal-overlay" onClick={() => setShowMemberModal(false)}>
          <div className="member-app" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', height: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Narayan Member Portal</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowMemberModal(false)}>✕</button>
            </div>
            <p style={{ color: 'var(--member-fg)', opacity: 0.8, fontSize: '13px', lineHeight: '1.5' }}>
              Untuk menikmati fitur pengelolaan tabungan mandiri, pengajuan rekening, penautan kotak fisik NFC, serta pencatatan setor dan tarik realtime, silakan masuk ke akun Anda.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <Link to="/login" className="btn btn-primary" style={{ flex: 1 }}>Masuk Akun</Link>
              <Link to="/register" className="btn btn-secondary" style={{ flex: 1 }}>Daftar Member</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

