import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './lookuplist.css'

export default function Lookuplist() {
  const [componentDb, setComponentDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchComponentDb = async () => {
      try {
        const response = await axios.get('http://localhost:5000/component_db', {
          timeout: 5000,
          signal: AbortSignal.timeout(5000) // Modern browsers
        });
        
        if (isMounted) {
          console.log('Received:', response.data);
          setComponentDb(response.data);
          console.log(componentDb)
        }
      } catch (err) {
        if (isMounted && !axios.isCancel(err)) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
  
    fetchComponentDb();
    return () => {
      isMounted = false; // Cleanup function
    };
  
  }, []);

  if (loading) return <div className="loading">Loading component database...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="lookup-list">
      <h2>Component Database</h2>
      
      {componentDb && (
        <div className="component-flex">
          {Object.entries(componentDb).map(([key, component]) => (
            <div key={key} className="component-card">
              <h3>{key}</h3>
              <div className="component-details">
                <p><strong>Type:</strong> {component.Component}</p>
                <p><strong>Subtype:</strong> {component.Subtype}</p>
                <p><strong>IO Device:</strong> {component.IO_Type}</p>
                
                <div className="io-section">
                  <h4>Inputs</h4>
                  <ul>
                    {component.Inputs.map((input, i) => (
                      <li key={i}>{input}</li>
                    ))}
                  </ul>
                </div>

                {component.Outputs && component.Outputs.length > 0 && (
                  <div className="io-section">
                    <h4>Outputs</h4>
                    <ul>
                      {component.Outputs.map((output, i) => (
                        <li key={i}>{output}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="cable-info">
                  <p><strong>Input Cable:</strong> {component.Input_Cable || 'N/A'}</p>
                  <p><strong>Output Cable:</strong> {component.Output_Cable || 'N/A'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
     
    </div>
  );
}
