import React from 'react'
import { Link } from 'react-router-dom'


export default function Nav() {
  return (
    <nav className="nav-con">
        <div className="nav-links">
           <Link to="/iolist"><h2>I/O list</h2></Link>
            <h2><a href="#" className="nav-link">Lookup list</a></h2>
            <h2><a href="#" className="nav-link">scanner list</a></h2>
            <h2><a href="#" className="nav-link">power list</a></h2>
        </div>
    </nav>
  )
}
