import React, { useState, useEffect } from 'react';
import axios from 'axios'; // Import axios
import Header from '../../components/header/header'; // Fixed import (assuming it's default export)
import './iolist.css';
import { Link } from 'react-router-dom';

export default function Iolist() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const fetchResults = async () => {
    setLoading(true);
    const controller = new AbortController(); // Create AbortController
    const signal = controller.signal;
    
    try {
      const response = await axios.get('http://localhost:5000/api/results', { 
        timeout: 5000,
        signal: signal 
      });
      
      console.log('Received:', response.data);
      setResults(response.data);
    } catch (err) {
      if (!axios.isCancel(err)) {
        setError(err.response?.data?.error || err.message || 'Failed to load results');
      }
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchResults();
    return () => {
      // Cleanup function to cancel request if component unmounts
      // You might want to add an AbortController here if needed
    };
  }, []);

  if (loading) return <div>Loading results...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!results) return <div>No results available</div>;

  return (
    <div className="results-container">
      <Header />
      <h2>DXF Processing Results</h2>
      
      <div className="sections">
        <div className="section">
          <h3>Total IO List</h3>
          <table>
            <thead>
              <tr>
                <th>Sequence</th>
                <th>Position</th>
                <th>Component</th>
                <th>Type</th>
                <th>Inputs</th>
                <th>Outputs</th>
                <th>Total IO</th>
              </tr>
            </thead>
            <tbody>
              {results.data?.Total_IO_List?.map((item, index) => (
                <tr key={index}>
                  <td>{item.Sequence}</td>
                  <td>{item.Position}</td>
                  <td>{item.Component}</td>
                  <td>{item.Subtype}</td>
                  <td>{item.Inputs}</td>
                  <td>{item.Outputs || 'None'}</td>
                  <td>{item.Total_IO}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="section">
          <h3>IO Configuration</h3>
          <table>
            <thead>
              <tr>
                <th>IO Device</th>
                <th>I/O</th>
                <th>I/O Name</th>
                <th>I/O Number</th>
                <th>Cable Type</th>
                <th>Port</th>
                <th>Pin</th>
              </tr>
            </thead>
            <tbody>
              {results.data?.IO_Configuration?.map((item, index) => (
                <tr key={index}>
                  <td>{item['IO device']}</td>
                  <td>{item['I/O']}</td>
                  <td>{item['I/O name']}</td>
                  <td>{item['I/O Number']}</td>
                  <td>{item['Cable type']}</td>
                  <td>{item['Port number'] || 'N/A'}</td>
                  <td>{item['Pin number']}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}