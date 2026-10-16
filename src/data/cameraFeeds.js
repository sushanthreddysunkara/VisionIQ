export const CAMERA_LIVE_STREAM_URL = 'http://35.183.17.145/'

export const cameraFeeds = [
  {
    id: 'CAM-NH44-04-MEDCHAL',
    name: 'CAM-NH44-04-MEDCHAL',
    location: 'Medchal',
    status: 'ACTIVE',
    streamPageUrl: CAMERA_LIVE_STREAM_URL,
  },
  {
    id: 'CAM-NH44-05-JADCHERLA',
    name: 'CAM-NH44-05-JADCHERLA',
    location: 'Jadcherla',
    status: 'ACTIVE',
    streamPageUrl: CAMERA_LIVE_STREAM_URL,
  },
  {
    id: 'CAM-NH44-06-TOLLPLAZA',
    name: 'CAM-NH44-06-TOLLPLAZA',
    location: 'Toll Plaza',
    status: 'ACTIVE',
    streamPageUrl: CAMERA_LIVE_STREAM_URL,
  },
  {
    id: 'CAM-NH44-02-SHADNAGAR',
    name: 'CAM-NH44-02-SHADNAGAR',
    location: 'Shadnagar',
    status: 'ACTIVE',
    streamPageUrl: CAMERA_LIVE_STREAM_URL,
  },
  {
    id: 'CAM-NH44-03-RINGROAD',
    name: 'CAM-NH44-03-RINGROAD',
    location: 'Ring Road',
    status: 'ACTIVE',
    streamPageUrl: CAMERA_LIVE_STREAM_URL,
  },
  {
    id: 'CAM-NH44-01-SHAMSHABAD',
    name: 'CAM-NH44-01-SHAMSHABAD',
    location: 'Shamshabad',
    status: 'ACTIVE',
    streamPageUrl: CAMERA_LIVE_STREAM_URL,
  },
]

export function getCameraFeed(camera) {
  if (!camera) return cameraFeeds[0]
  const feed = cameraFeeds.find((item) => item.id === camera.id || item.name === camera.name)

  return {
    ...feed,
    ...camera,
    name: camera.name || feed?.name || camera.id,
    location: camera.location || feed?.location || 'NH-44 Corridor',
    status: camera.status || feed?.status || 'ACTIVE',
    streamPageUrl: CAMERA_LIVE_STREAM_URL,
  }
}
