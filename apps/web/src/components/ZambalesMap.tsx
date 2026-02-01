import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix default icon paths for Vite bundling
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

type Pin = { name: string; position: [number, number] }

// Approximate center and pins (can be refined later)
const center: [number, number] = [15.327, 119.973]
const pins: Pin[] = [
  { name: 'Iba (Capital)', position: [15.327, 119.977] },
  { name: 'Subic', position: [14.879, 120.234] },
  { name: 'Olongapo (nearby)', position: [14.838, 120.284] },
  { name: 'Masinloc', position: [15.536, 119.950] },
]

export default function ZambalesMap() {
  return (
    <div className="overflow-hidden rounded-xl shadow">
      <MapContainer center={center} zoom={9} style={{ height: 420, width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.map((p) => (
          <Marker key={p.name} position={p.position}>
            <Popup>
              {p.name}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}


