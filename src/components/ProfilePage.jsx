import { Mail, ShieldCheck, UserCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function ProfilePage() {
  const { user } = useAuth()
  const initials = (user?.displayName || user?.username || 'VI').slice(0, 2).toUpperCase()

  return (
    <div className="account-page">
      <div className="page-intro">
        <div><p className="section-kicker">ACCOUNT</p><h1>Profile</h1><p className="intro-copy">Your VisionIQ workspace identity and access details.</p></div>
      </div>
      <section className="profile-hero">
        <div className="profile-avatar">{user?.profilePhoto ? <img alt="Profile" src={user.profilePhoto} /> : initials}</div>
        <div><p className="section-kicker">ACTIVE MEMBER</p><h2>{user?.displayName || user?.username || 'VisionIQ user'}</h2><p>{user?.jobTitle || 'VisionIQ operator'}</p></div>
      </section>
      <section className="account-detail-grid">
        <div className="account-detail"><Mail size={19} /><span>Email</span><strong>{user?.email || 'Not provided'}</strong></div>
        <div className="account-detail"><UserCircle size={19} /><span>Username</span><strong>{user?.username || 'Not provided'}</strong></div>
        <div className="account-detail"><ShieldCheck size={19} /><span>Access level</span><strong>{user?.role || 'Operator'}</strong></div>
      </section>
    </div>
  )
}