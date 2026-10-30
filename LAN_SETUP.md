# Run VisionIQ on a LAN

Run both services on the computer that contains the project and database access.

## 1. Find the host computer IP

In PowerShell:

```powershell
ipconfig
```

Use the IPv4 address for the active Wi-Fi or Ethernet adapter, for example `192.168.1.25`.

## 2. Start the backend

```powershell
cd VisionIQ\backend
npm.cmd start
```

The backend listens on all interfaces at port `5000`.

## 3. Start the frontend

```powershell
cd VisionIQ
npm.cmd run dev -- --host 0.0.0.0
```

The frontend listens on all interfaces at port `5173`.

## 4. Open from another computer

On the same Wi-Fi or LAN, open:

```text
http://192.168.1.25:5173
```

Replace the IP with the host computer's IPv4 address.

## Windows Firewall

If another computer cannot open the page, allow inbound TCP ports `5173` and `5000` in Windows Defender Firewall. Keep the network marked Private and do not expose these development ports to the public internet.

## Database note

The backend computer must be able to reach the MySQL server configured in `backend/.env`. Other computers do not need MySQL installed because they connect only to the frontend host.

## Separate frontend hosting

When the frontend is hosted without the Vite proxy, set `VITE_API_URL` to the backend LAN URL before building, for example:

```env
VITE_API_URL=http://192.168.1.25:5000
```
