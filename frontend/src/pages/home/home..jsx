import React from 'react'
import Header from '../../components/header/header'
import './home.css'
import Lookuplist from '../iolist/lookuplist/lookuplist'
import UploadDxf from '../../components/uploaddxf/uploaddxf'

export default function Home() {
  return (
    <div className='home'>
        <Header />
        <UploadDxf />
        <Lookuplist />
    </div>
  )
}
