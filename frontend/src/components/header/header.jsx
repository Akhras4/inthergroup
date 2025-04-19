import React from 'react'
import Nav from './nav'
import './header.css'

export default function header() {
  return (
    <header>
        <div className='logo'>
        <img src="https://inthergroup.nl/_theme/inther/images/frontend/Inther-Logo.svg"/>
        </div>
        <Nav/>
    </header>
  )
}
