import { useEffect, useState } from 'react'
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  doc,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

import { db, storage } from './firebase'
import './App.css'

function App() {
  const [showAircraftForm, setShowAircraftForm] = useState(false)
  const [selectedAircraft, setSelectedAircraft] = useState(null)
  const [showDamageForm, setShowDamageForm] = useState(false)

  const [aircraftList, setAircraftList] = useState([])
  const [inspectionList, setInspectionList] = useState([])
  const [damageList, setDamageList] = useState([])

  const [aircraft, setAircraft] = useState({
    registration: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
  })

  const [inspection, setInspection] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Routine Inspection',
    technician: '',
    notes: '',
  })

  const [damage, setDamage] = useState({
    component: '',
    type: 'Scratch',
    severity: 'Minor',
    description: '',
  })
  
  const [imageFile, setImageFile] = useState(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'aircraft'),
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }))
        setAircraftList(data)
        setLoading(false)
      },
      (err) => {
        console.error(err)
        setError('No se pudieron cargar las aeronaves.')
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!selectedAircraft) {
      setInspectionList([])
      setDamageList([])
      return
    }

    const inspectionsQuery = query(
      collection(db, 'inspections'),
      where('aircraftId', '==', selectedAircraft.id)
    )

    const damagesQuery = query(
      collection(db, 'damages'),
      where('aircraftId', '==', selectedAircraft.id)
    )

    const unsubInspections = onSnapshot(inspectionsQuery, (snapshot) => {
      setInspectionList(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    }, (err) => console.error(err))

    const unsubDamages = onSnapshot(damagesQuery, (snapshot) => {
      setDamageList(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    }, (err) => console.error(err))

    return () => {
      unsubInspections()
      unsubDamages()
    }
  }, [selectedAircraft])

  function handleAircraftChange(event) {
    const { name, value } = event.target
    setAircraft((prev) => ({ ...prev, [name]: value }))
  }

  function handleInspectionChange(event) {
    const { name, value } = event.target
    setInspection((prev) => ({ ...prev, [name]: value }))
  }

  function handleDamageChange(event) {
    const { name, value } = event.target
    setDamage((prev) => ({ ...prev, [name]: value }))
  }

  async function handleAircraftSubmit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)

    try {
      await addDoc(collection(db, 'aircraft'), {
        registration: aircraft.registration.trim().toUpperCase(),
        manufacturer: aircraft.manufacturer.trim(),
        model: aircraft.model.trim(),
        serialNumber: aircraft.serialNumber.trim(),
        status: 'Operativo',
        lastInspection: new Date().toLocaleDateString(),
        createdAt: new Date().toISOString(),
      })

      setAircraft({ registration: '', manufacturer: '', model: '', serialNumber: '' })
      setShowAircraftForm(false)
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar la aeronave.')
    } finally {
      setSaving(false)
    }
  }

  async function handleInspectionSubmit(event) {
    event.preventDefault()
    setError('')

    if (!selectedAircraft) {
      setError('Selecciona una aeronave primero.')
      return
    }

    setSaving(true)

    try {
      await addDoc(collection(db, 'inspections'), {
        aircraftId: selectedAircraft.id,
        registration: selectedAircraft.registration,
        date: inspection.date,
        type: inspection.type,
        technician: inspection.technician.trim(),
        notes: inspection.notes.trim(),
        createdAt: new Date().toISOString(),
      })

      setInspection({
        date: new Date().toISOString().split('T')[0],
        type: 'Routine Inspection',
        technician: '',
        notes: '',
      })
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar la inspección.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDamageSubmit(event) {
    event.preventDefault()
    setError('')

    if (!selectedAircraft) {
      setError('Selecciona una aeronave primero.')
      return
    }

    setSaving(true)

    try {
      let imageUrl = ''

      if (imageFile) {
        const storageRef = ref(storage, `damages/${selectedAircraft.id}/${Date.now()}_${imageFile.name}`)
        const snapshot = await uploadBytes(storageRef, imageFile)
        imageUrl = await getDownloadURL(snapshot.ref)
      }

      await addDoc(collection(db, 'damages'), {
        aircraftId: selectedAircraft.id,
        registration: selectedAircraft.registration,
        component: damage.component.trim(),
        type: damage.type,
        severity: damage.severity,
        description: damage.description.trim(),
        imageUrl: imageUrl,
        createdAt: new Date().toISOString(),
      })

      setDamage({
        component: '',
        type: 'Scratch',
        severity: 'Minor',
        description: '',
      })
      setImageFile(null)
      setShowDamageForm(false)
    } catch (err) {
      console.error(err)
      setError('No se pudo registrar el daño o subir la imagen.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAircraft(aircraftId, event) {
    event.stopPropagation()
    if (!window.confirm('¿Estás seguro de eliminar esta aeronave y todos sus registros?')) return

    try {
      await deleteDoc(doc(db, 'aircraft', aircraftId))
      if (selectedAircraft && selectedAircraft.id === aircraftId) {
        setSelectedAircraft(null)
      }
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar la aeronave.')
    }
  }

  async function handleDeleteDamage(damageId) {
    if (!window.confirm('¿Estás seguro de eliminar este registro de daño?')) return

    try {
      await deleteDoc(doc(db, 'damages', damageId))
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar el daño.')
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-titles">
          <h1>Mapeo de daños en aeronaves</h1>
          <p>Sistema de inspección y registro de daños estructurales</p>
        </div>

        <button
          className="primary-button"
          onClick={() => setShowAircraftForm(!showAircraftForm)}
        >
          {showAircraftForm ? 'Cancelar' : '+ Registrar Aeronave'}
        </button>
      </header>

      <main>
        {/* Banner de Bienvenida */}
        <section className="welcome-banner">
          <div className="welcome-content">
            <h2>Bienvenido al Sistema de Mantenimiento</h2>
            <p>
              Selecciona una aeronave de la flota inferior para acceder a su panel de inspecciones, mapeo estructural por zonas y reportes de daños.
            </p>
          </div>
        </section>

        {/* Panel de Estadísticas */}
        <section className="stats">
          <div className="stat-card stat-card-horizontal">
            <img src="/icons/aircraft.png" alt="Aeronaves" className="custom-stat-icon" />
            <div className="stat-info">
              <span>Total Aeronaves</span>
              <h2>{aircraftList.length}</h2>
            </div>
          </div>

          <div className="stat-card stat-card-horizontal">
            <img src="/icons/inspection.png" alt="Inspecciones" className="custom-stat-icon" />
            <div className="stat-info">
              <span>Inspecciones</span>
              <h2>{inspectionList.length}</h2>
            </div>
          </div>

          <div className="stat-card stat-card-horizontal">
            <img src="/icons/reports.png" alt="Daños" className="custom-stat-icon" />
            <div className="stat-info">
              <span>Registros de Daños</span>
              <h2>{damageList.length}</h2>
            </div>
          </div>
        </section>

        {error && <p className="error-message">{error}</p>}

        {showAircraftForm && (
          <section className="form-card">
            <h2>Registrar Nueva Aeronave</h2>
            <form onSubmit={handleAircraftSubmit}>
              <label>
                Matrícula (Registration)
                <input
                  name="registration"
                  value={aircraft.registration}
                  onChange={handleAircraftChange}
                  placeholder="Ej. XA-ABC"
                  required
                />
              </label>

              <label>
                Fabricante
                <input
                  name="manufacturer"
                  value={aircraft.manufacturer}
                  onChange={handleAircraftChange}
                  placeholder="Ej. Piper, Cessna"
                  required
                />
              </label>

              <label>
                Modelo
                <input
                  name="model"
                  value={aircraft.model}
                  onChange={handleAircraftChange}
                  placeholder="Ej. PA-23 Aztec"
                  required
                />
              </label>

              <label>
                Número de Serie
                <input
                  name="serialNumber"
                  value={aircraft.serialNumber}
                  onChange={handleAircraftChange}
                  required
                />
              </label>

              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Aeronave'}
              </button>
            </form>
          </section>
        )}

        {selectedAircraft && (
          <div className="selected-aircraft-panel">
            <div className="panel-header">
              <h2>Panel Activo: {selectedAircraft.registration}</h2>
              <button className="secondary-button" onClick={() => setSelectedAircraft(null)}>
                Cerrar Panel
              </button>
            </div>

            <div className="action-buttons-group">
              <button 
                className="primary-button" 
                onClick={() => setShowDamageForm(!showDamageForm)}
              >
                {showDamageForm ? 'Cerrar Form. Daño' : '+ Reportar Daño'}
              </button>
            </div>

            <section className="form-card aircraft-diagram-section">
              <h3>Mapeo Estructural por Zonas</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Selecciona una sección para reportar un daño en esa zona específica.
              </p>

              <div className="aircraft-map-grid">
                {[
                  { id: 'Nariz / Radomo', label: 'Nariz (Nose)' },
                  { id: 'Ala Izquierda', label: 'Plano Izquierdo (Left Wing)' },
                  { id: 'Fuselaje Central', label: 'Fuselaje Central' },
                  { id: 'Ala Derecha', label: 'Plano Derecho (Right Wing)' },
                  { id: 'Cola / Empenaje', label: 'Cola / Empenaje (Tail)' }
                ].map((zone) => {
                  const zoneDamages = damageList.filter(d => d.component === zone.id);
                  const hasSevere = zoneDamages.some(d => d.severity === 'Severe');

                  return (
                    <div 
                      key={zone.id} 
                      className={`zone-card ${zoneDamages.length > 0 ? (hasSevere ? 'zone-severe' : 'zone-active') : ''}`}
                      onClick={() => {
                        setDamage(prev => ({ ...prev, component: zone.id }));
                        setShowDamageForm(true);
                      }}
                    >
                      <h4>{zone.label}</h4>
                      <span className="zone-badge">
                        {zoneDamages.length} {zoneDamages.length === 1 ? 'daño reportado' : 'daños reportados'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {showDamageForm && (
              <section className="form-card">
                <h3>Registrar Daño Estructural</h3>
                <form onSubmit={handleDamageSubmit}>
                  <label>
                    Componente / Sección
                    <input
                      name="component"
                      value={damage.component}
                      onChange={handleDamageChange}
                      placeholder="Ej. Ala derecha, Timón de dirección"
                      required
                    />
                  </label>

                  <label>
                    Tipo de Daño
                    <select name="type" value={damage.type} onChange={handleDamageChange}>
                      <option value="Scratch">Rayón / Rasguño (Scratch)</option>
                      <option value="Dent">Abolladura (Dent)</option>
                      <option value="Corrosion">Corrosión</option>
                      <option value="Crack">Grieta (Crack)</option>
                    </select>
                  </label>

                  <label>
                    Severidad
                    <select name="severity" value={damage.severity} onChange={handleDamageChange}>
                      <option value="Minor">Menor (Minor)</option>
                      <option value="Moderate">Moderada (Moderate)</option>
                      <option value="Severe">Severa (Severe)</option>
                    </select>
                  </label>

                  <label>
                    Fotografía de Evidencia
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files[0])}
                    />
                  </label>

                  <label>
                    Descripción
                    <textarea
                      name="description"
                      value={damage.description}
                      onChange={handleDamageChange}
                      placeholder="Detalles de la anomalía..."
                      rows="3"
                    />
                  </label>

                  <button type="submit" className="primary-button" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar Daño'}
                  </button>
                </form>
              </section>
            )}

            <section className="form-card">
              <h3>Nueva Inspección</h3>
              <form onSubmit={handleInspectionSubmit}>
                <label>
                  Fecha de Inspección
                  <input
                    type="date"
                    name="date"
                    value={inspection.date}
                    onChange={handleInspectionChange}
                    required
                  />
                </label>

                <label>
                  Tipo de Inspección
                  <select name="type" value={inspection.type} onChange={handleInspectionChange}>
                    <option>Routine Inspection</option>
                    <option>Detailed Inspection</option>
                    <option>Damage Inspection</option>
                    <option>Post-Maintenance Inspection</option>
                  </select>
                </label>

                <label>
                  Técnico Encargado
                  <input
                    name="technician"
                    value={inspection.technician}
                    onChange={handleInspectionChange}
                    placeholder="Nombre del técnico"
                    required
                  />
                </label>

                <label>
                  Notas / Observaciones
                  <textarea
                    name="notes"
                    value={inspection.notes}
                    onChange={handleInspectionChange}
                    placeholder="Observaciones de la aeronave"
                    rows="3"
                  />
                </label>

                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Inspección'}
                </button>
              </form>
            </section>

            <div className="history-grid">
              <section className="aircraft-section">
                <h3>Historial de Daños ({damageList.length})</h3>
                {damageList.length === 0 ? (
                  <p>Sin daños reportados.</p>
                ) : (
                  <div className="aircraft-list">
                    {damageList.map((item) => (
                      <article className="aircraft-card damage-card" key={item.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <h4>{item.component}</h4>
                          <button 
                            onClick={() => handleDeleteDamage(item.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--accent-damage)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                          >
                            ✕ Eliminar
                          </button>
                        </div>

                        <p><strong>Tipo:</strong> {item.type}</p>
                        <p><strong>Severidad:</strong> {item.severity}</p>
                        <p>{item.description || 'Sin descripción'}</p>
                        
                        {item.imageUrl && (
                          <img 
                            src={item.imageUrl} 
                            alt="Evidencia" 
                            style={{ width: '100%', borderRadius: '8px', marginTop: '8px', objectFit: 'cover', maxHeight: '160px' }} 
                          />
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="aircraft-section">
                <h3>Historial de Inspecciones ({inspectionList.length})</h3>
                {inspectionList.length === 0 ? (
                  <p>No hay inspecciones registradas.</p>
                ) : (
                  <div className="aircraft-list">
                    {inspectionList.map((item) => (
                      <article className="aircraft-card" key={item.id}>
                        <h4>{item.type}</h4>
                        <p><strong>Fecha:</strong> {item.date}</p>
                        <p><strong>Técnico:</strong> {item.technician}</p>
                        <p>{item.notes || 'Sin notas'}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* Flota Registrada */}
        <section className="aircraft-section">
          <h2>Flota Registrada</h2>

          {loading ? (
            <p>Cargando aeronaves...</p>
          ) : aircraftList.length === 0 ? (
            <p>No hay aeronaves registradas todavía.</p>
          ) : (
            <div className="aircraft-list">
              {aircraftList.map((item) => (
                <article className="aircraft-card fleet-card" key={item.id}>
                  <div className="fleet-card-header">
                    <div className="fleet-icon-airplane">✈️</div>
                    <div className="fleet-titles">
                      <h3>{item.registration}</h3>
                      <p className="fleet-model">Modelo {item.model}</p>
                    </div>
                  </div>

                  <div className="fleet-details">
                    <p><span>N.S.:</span> {item.serialNumber}</p>
                    <div className="fleet-status-row">
                      <span>Estado</span>
                      <span className={`status-badge ${item.status === 'Mantenimiento Requerido' ? 'status-warning' : 'status-success'}`}>
                        {item.status || 'OPERATIVO'}
                      </span>
                    </div>
                    <p className="fleet-inspection-date">Última inspección: {item.lastInspection || 'N/A'}</p>
                  </div>

                  <div className="fleet-actions">
                    <button
                      className="primary-button"
                      onClick={() => {
                        setError('')
                        setSelectedAircraft(item)
                      }}
                    >
                      Gestionar
                    </button>

                    <button
                      className="danger-outline-button"
                      onClick={(e) => handleDeleteAircraft(item.id, e)}
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App