import React, { useState } from 'react';
import axios from 'axios';
import './upload.css';

export default function UploadDxf({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [expandedDevices, setExpandedDevices] = useState({});

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setUploadStatus('');
      setResults(null);
      setExpandedDevices({});
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }
  
    if (!file.name.endsWith('.dxf')) {
      setError('Only DXF files are allowed');
      return;
    }
  
    const formData = new FormData();
    formData.append('file', file);
  
    try {
      setUploadStatus('uploading');
      setUploadProgress(0);
      setError('');
      setResults(null);
  
      const response = await axios.post('http://localhost:5000/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        }
      });
  
      setUploadStatus('success');
      console.log('API Response:', response.data); // Debug log
  
      // Transform the API response to match your expected structure
      const apiData = response.data.data || response.data;
      
      // If the data is already in the correct format, use it directly
      if (apiData['Total IO List'] && apiData['IO Configuration']) {
        setResults(apiData);
        if (onUploadSuccess) onUploadSuccess(apiData);
        console.log("apiData:",apiData)
        return;
      }
  
      // Create a default structure if data is missing
      const transformedData = {
        'Total IO List': apiData.Total_IO_List || apiData['Total IO List'] || [],
        'IO Configuration': apiData.IO_Configuration || apiData['IO Configuration'] || [],
        timestamp: apiData.timestamp || new Date().toISOString(),
        source_file: apiData.source_file || file.name
      };
  
      console.log('Transformed Data:', transformedData); // Debug log
      setResults(transformedData);
      
      if (onUploadSuccess) {
        onUploadSuccess(transformedData);
      }
      
    } catch (err) {
      setUploadStatus('error');
      const errorMessage = err.response?.data?.error || 
                         err.message || 
                         'Upload failed. Please try again.';
      setError(errorMessage);
      console.error('Upload error:', err);
    }
  };

  const toggleDeviceExpansion = (deviceId) => {
    setExpandedDevices(prev => ({
      ...prev,
      [deviceId]: !prev[deviceId]
    }));
  };

  const handleIoDeviceChange = (deviceIndex, newValue) => {
    if (!results) return;
    
    const updatedResults = { ...results };
    const ioDeviceNum = parseInt(newValue) || 0;
    updatedResults['Total IO List'][deviceIndex]['IO Device'] = ioDeviceNum;
    
    // Update corresponding IO Configuration entries
    const componentPrefix = updatedResults['Total IO List'][deviceIndex].Position.replace('.', '');
    const isFio = updatedResults['Total IO List'][deviceIndex].Subtype === 'fio';
    const deviceType = isFio ? 'fio' : 'io';
    
    updatedResults['IO Configuration'] = updatedResults['IO Configuration'].map(item => {
      if (item['IO device'] === `${deviceType}${componentPrefix}`) {
        const ioType = item['I/O'].toUpperCase();
        const port = item['Port number'] || 0;
        return {
          ...item,
          'I/O Number': `${ioType}${ioDeviceNum}.${port}`
        };
      }
      return item;
    });
    
    setResults(updatedResults);
    
  };

  const renderDeviceDetails = (device, index) => {
    if (!device) return null;
    
    const deviceId = `${device.Position}-${index}`;
    const isExpanded = expandedDevices[deviceId];
    const componentPrefix = device.Position?.replace('.', '') || '';
    const isFio = device.Subtype === 'fio';
    const deviceType = isFio ? 'fio' : 'io';
    const configItems = results?.['IO Configuration']?.filter(
      item => item?.['IO device'] === `${deviceType}${componentPrefix}`
    );
    const inputs = device.Inputs ? device.Inputs.split(', ') : [];
    const outputs = device.Outputs ? device.Outputs.split(', ') : [];
    

    return ( 
    <div key={deviceId} className="device-container">
        <div className="device-header" onClick={() => toggleDeviceExpansion(deviceId)}>
          <div className="device-summary">
            <span className="position">{device.Position || 'N/A'}</span>
            <span className="component">{device.Component || 'Unknown'}</span>
            <span className="subtype">{device.Subtype || ''}</span>
            <div className="io-device-input-container">
              <label>IO Device:</label>
              <input
                type="number"
                value={device['IO Device'] || ''}
                onChange={(e) => handleIoDeviceChange(index, e.target.value)}
                min="1"
                className="io-device-input"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <span className="toggle-icon">
            {isExpanded ? '▼' : '►'}
          </span>
        </div>
  
        {isExpanded && (
          <div className="device-details">
            {inputs.length > 0 && (
              <div className="io-section">
                <h4>Inputs</h4>
                <ul>
                  {inputs.map((input, i) => (
                    <li key={`in-${deviceId}-${i}`}>
                      <span className="io-name">{input}</span>
                      {configItems && configItems[i] && (
                        <span className="io-config">
                          {configItems[i]['I/O Number'] || 'N/A'} (Pin {configItems[i]['Pin number'] || 'N/A'})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
  
            {outputs.length > 0 && (
              <div className="io-section">
                <h4>Outputs</h4>
                <ul>
                  {outputs.map((output, i) => {
                    const outputConfig = configItems?.find(
                      item => item?.['I/O name'] === output
                    );
                    return (
                      <li key={`out-${deviceId}-${i}`}>
                        <span className="io-name">{output}</span>
                        {outputConfig && (
                          <span className="io-config">
                            {outputConfig['I/O Number'] || 'N/A'} (Pin {outputConfig['Pin number'] || 'N/A'})
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
  
            <div className="cable-info">
              <p><strong>Input Cable:</strong> {device.Input_Cable || 'N/A'}</p>
              {device.Output_Cable && <p><strong>Output Cable:</strong> {device.Output_Cable}</p>}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderResults = () => {
    if (!results) return null;

    return (
      <div className="results-section">
        <h3>Processing Results</h3>
        
        <div className="devices-hierarchy">
          {results['Total IO List']?.map((device, index) => (
            renderDeviceDetails(device, index)
          ))}
        </div>

        <div className="full-configuration">
          <h4>Full IO Configuration</h4>
          <table>
            <thead>
              <tr>
                <th>Device</th>
                <th>Type</th>
                <th>I/O</th>
                <th>Number</th>
                <th>Port</th>
                <th>Pin</th>
                <th>Cable</th>
              </tr>
            </thead>
            <tbody>
              {results['IO Configuration']?.map((item, index) => (
                <tr key={`config-${index}`}>
                  <td>{item['IO device']}</td>
                  <td>{item['I/O']}</td>
                  <td>{item['I/O name']}</td>
                  <td>{item['I/O Number']}</td>
                  <td>{item['Port number'] ?? '-'}</td>
                  <td>{item['Pin number']}</td>
                  <td>{item['Cable type']}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="upload-container">
      <h2>Upload DXF File</h2>
      
      <div className="file-input-container">
        <input
          type="file"
          id="dxf-upload"
          accept=".dxf"
          onChange={handleFileChange}
          className="file-input"
        />
        <label htmlFor="dxf-upload" className="file-label">
          {file ? file.name : 'Choose DXF file'}
        </label>
      </div>

      {file && (
        <div className="file-info">
          <p>Selected file: {file.name}</p>
          <p>Size: {(file.size / 1024).toFixed(2)} KB</p>
        </div>
      )}

      <button 
        onClick={handleUpload}
        disabled={!file || uploadStatus === 'uploading'}
        className="upload-button"
      >
        {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload'}
      </button>

      {uploadStatus === 'uploading' && (
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${uploadProgress}%` }}
          ></div>
          <span>{uploadProgress}%</span>
        </div>
      )}

      {uploadStatus === 'success' && (
        <div className="success-message">
          File uploaded and processed successfully!
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {renderResults()}
     
  </div>
    
  );
}