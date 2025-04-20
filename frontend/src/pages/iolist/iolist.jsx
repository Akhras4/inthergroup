import React from 'react'
import { useState,useEffect } from 'react'
import header from '../../components/header/header'
import './iolist.css'
import { Link } from 'react-router-dom'
export default function Iolist() {
 
    const [results, setResults] = useState(null);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState('');
    
      const fetchResults = async () => {
        setLoading(true);
        try {
          const response = await axios.get('http://localhost:5000/api/results',{ timeout: 5000,
            signal: AbortSignal.timeout(5000)});
          
          if (isMounted) {
            console.log('Received:', response.data);
            setResults(response.data);
          }
        } catch (err) {
            if (isMounted && !axios.isCancel(err)){
          setError(err.response?.data?.error || 'Failed to load results');
            }
        } finally {
            if (isMounted) {
          setLoading(false);
        }
    }
      };
      
      useEffect(() => {
        let isMounted = true;
        fetchResults();
        return () => {
            isMounted = false; // Cleanup function
          };
        
      }, []);
    
      if (loading) return <div>Loading results...</div>;
      if (error) return <div>Error: {error}</div>;
      if (!results) return <div>No results available</div>;
    
      return (
        <div className="results-container">
          <h2>DXF Processing Results</h2>
          
          <div className="sections">
            <div className="section">
              <h3>Total IO List</h3>
              <table>
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Component</th>
                    <th>Inputs</th>
                    <th>Outputs</th>
                  </tr>
                </thead>
                <tbody>
                  {results['Total IO List']?.map((item, index) => (
                    <tr key={index}>
                      <td>{item.Position}</td>
                      <td>{item.Component}</td>
                      <td>{item.Inputs}</td>
                      <td>{item.Outputs || 'None'}</td>
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
                    <th>I/O Name</th>
                    <th>I/O Number</th>
                    <th>Cable Type</th>
                  </tr>
                </thead>
                <tbody>
                  {results['IO Configuration']?.map((item, index) => (
                    <tr key={index}>
                      <td>{item['IO device']}</td>
                      <td>{item['I/O name']}</td>
                      <td>{item['I/O Number']}</td>
                      <td>{item['Cable type']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        );
        }
    
    

    
