import React, { useState, useEffect, useCallback, memo, useContext } from 'react'

import {
  Accordion,
  AccordionItem,
  AccordionItemHeading,
  AccordionItemPanel,
  AccordionItemButton,
} from 'react-accessible-accordion';
import { useDebounce } from 'use-debounce';

import Context from '../context';

import ErrorBoundary from '@cdc/core/components/ErrorBoundary'
import Waiting from '@cdc/core/components/Waiting'

// IE11 Custom Event polyfill
(function () {

  if ( typeof window.CustomEvent === "function" ) return false;

  function CustomEvent ( event, params ) {
    params = params || { bubbles: false, cancelable: false, detail: null };
    var evt = document.createEvent( 'CustomEvent' );
    evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
    return evt;
   }

  window.CustomEvent = CustomEvent;
})();

const TextField = memo(({label, section = null, subsection = null, fieldName, updateField, value: stateValue, type = "input", i = null, ...attributes}) => {
  const [ value, setValue ] = useState(stateValue);

  const [ debouncedValue ] = useDebounce(value, 500);

  useEffect(() => {
    if('string' === typeof debouncedValue && stateValue !== debouncedValue ) {
      updateField(section, subsection, fieldName, debouncedValue, i)
    }
  }, [debouncedValue])

  let name = subsection ? `${section}-${subsection}-${fieldName}` : `${section}-${subsection}-${fieldName}`;

  const onChange = (e) => setValue(e.target.value);

  let formElement = <input type="text" name={name} onChange={onChange} {...attributes} value={value} />

  if('textarea' === type) {
    formElement = (
      <textarea name={name} onChange={onChange} {...attributes} value={value}></textarea>
    )
  }
  
  if('number' === type) {
    formElement = <input type="number" name={name} onChange={onChange} {...attributes} value={value} />
  }

  return (
    <label>
      <span className="edit-label column-heading">{label}</span>
      {formElement}
    </label>
  )
})

const CheckBox = memo(({label, value, fieldName, section = null, subsection = null, updateField, ...attributes}) => (
  <label className="checkbox">
    <input type="checkbox" name={fieldName} checked={ value } onChange={() => { updateField(section, subsection, fieldName, !value) }} {...attributes}/>
    <span className="edit-label">{label}</span>
  </label>
))

const Select = memo(({label, value, options, fieldName, section = null, subsection = null, updateField, initial: initialValue, ...attributes}) => {
  let optionsJsx = options.map(optionName => <option value={optionName} key={optionName}>{optionName}</option>)

  if(initialValue) {
    optionsJsx.unshift(<option value="" key="initial" disabled>{initialValue}</option>)
  }

  return (
    <label>
      <span className="edit-label">{label}</span>
      <select name={fieldName} value={value} onChange={(event) => { updateField(section, subsection, fieldName, event.target.value) }} {...attributes}>
        {optionsJsx}
      </select>
    </label>
  )
})

const Regions = memo(({config, updateConfig}) => {
  let regionUpdate = (fieldName, value, i) => {
    let regions = []

    if(config.regions) {
      regions = [...config.regions]
    }

    regions[i][fieldName] = value
    updateConfig({...config, regions})
  }

  let updateField = (section, subsection, fieldName, value, i) => regionUpdate(fieldName, value, i)

  let removeColumn = (i) => {
    let regions = []

    if(config.regions) {
      regions = [...config.regions]
    }

    regions.splice(i, 1)

    updateConfig({...config, regions})
  }

  let addColumn = () => {
    let regions = []

    if(config.regions) {
      regions = [...config.regions]
    }

    regions.push({})

    updateConfig({...config, regions})
  }

  return (
    <>
      {config.regions && config.regions.map(({label, color, from, to, background}, i) => (
        <div className="edit-block" key={`region-${i}`}>
          <button className="remove-column" onClick={(event) => { event.preventDefault(); removeColumn(i)}}>Remove</button>
          <TextField value={label} label="Region Label" fieldName="label" i={i} updateField={updateField} />
          <div className="two-col-inputs">
            <TextField value={color} label="Text Color" fieldName="color" updateField={(section, subsection, fieldName, value) => regionUpdate(fieldName, value, i)} />
            <TextField value={background} label="Background" fieldName="background" updateField={(section, subsection, fieldName, value) => regionUpdate(fieldName, value, i)} />
          </div>
          <div className="two-col-inputs">
            <TextField value={from} label="From Value" fieldName="from" updateField={(section, subsection, fieldName, value) => regionUpdate(fieldName, value, i)} />
            <TextField value={to} label="To Value" fieldName="to" updateField={(section, subsection, fieldName, value) => regionUpdate(fieldName, value, i)} />
          </div>
        </div>
      ))}
      <button className="btn full-width" onClick={(e) => {e.preventDefault(); addColumn()}}>Add Region</button>
    </>
  )
})

const headerColors = ['theme-blue','theme-purple','theme-brown','theme-teal','theme-pink','theme-orange','theme-slate','theme-indigo','theme-cyan','theme-green','theme-amber']

const EditorPanel = memo(() => {
  const { config, updateConfig, loading, colorPalettes, data, setDimensions, dimensions } = useContext(Context);

  const enforceRestrictions = (updatedConfig) => {
    if(updatedConfig.visualizationSubType === 'horizontal'){
      updatedConfig.labels = false;
    }
  };

  const updateField = (section, subsection, fieldName, newValue) => {
    // Top level
    if( null === section && null === subsection) {
      let updatedConfig = {...config, [fieldName]: newValue};

      enforceRestrictions(updatedConfig);

      updateConfig(updatedConfig);
      return
    }

    const isArray = Array.isArray(config[section]);

    let sectionValue = isArray ? [...config[section], newValue] : {...config[section], [fieldName]: newValue};

    if(null !== subsection) {
      if(isArray) {
        sectionValue = [...config[section]]
        sectionValue[subsection] = {...sectionValue[subsection], [fieldName]: newValue}
      } else if(typeof newValue === "string") {
        sectionValue[subsection] = newValue
      } else {
        sectionValue = {...config[section], [subsection]: { ...config[section][subsection], [fieldName]: newValue}}
      }
    }

    let updatedConfig = {...config, [section]: sectionValue};

    enforceRestrictions(updatedConfig);
    
    updateConfig({...config, ...updatedConfig})
  }

  const [ addSeries, setAddSeries ] = useState('');
  const [ displayPanel, setDisplayPanel ] = useState(true)

  // Used to pipe a JSON version of the config you are creating out
  const [ configData, setConfigData ] = useState({})

  if(loading) {
    return null
  }

  const removeSeriesKey = (i) => {
    let seriesKeys = [...config.seriesKeys]
    seriesKeys.splice(i, 1)

    let newConfig = {...config, seriesKeys}

    if(seriesKeys.length === 0) {
      delete newConfig.seriesKeys
    }

    updateConfig(newConfig)
  }

  const addNewSeries = (value) => {
    let newSeriesKeys = config.seriesKeys ? [...config.seriesKeys] : []
    newSeriesKeys.push(value)
    updateConfig({...config, seriesKeys: newSeriesKeys})
  }

  const getColumns = (filter = true) => {
    let columns = {}

    data.map(row => {
      Object.keys(row).forEach(columnName => columns[columnName] = true)
    })

    if(filter) {
      Object.keys(columns).forEach(key => {
        if((config.seriesKeys && config.seriesKeys.includes(key)) || (config.confidenceKeys && Object.keys(config.confidenceKeys).includes(key)) ) {
          delete columns[key]
        }
      })
    }

    return Object.keys(columns)
  }

  const Confirm = () => {
    return (
      <section className="waiting">
        <section className="waiting-container">
          <h3>Finish Configuring</h3>
          <p>Set all your options to the left and confirm below to display a preview of the chart.</p>
          <button className="btn" style={{margin: '1em auto'}} onClick={(e) => {e.preventDefault(); updateConfig({...config, newViz: false})}}>I'm Done</button>
        </section>
      </section>
    );
  }

  const convertStateToConfigFile = () => {
    let strippedState = JSON.parse(JSON.stringify(config))
    delete strippedState.newViz
    delete strippedState.runtime

    return JSON.stringify( strippedState )
  }

  useEffect(() => {
    const parsedData = convertStateToConfigFile()

    const formattedData = JSON.stringify(JSON.parse(parsedData), undefined, 2);

    setConfigData(formattedData)

    // Emit the data in a regular JS event so it can be consumed by anything.
    const event = new CustomEvent('updateMapConfig', { detail: parsedData})

    window.dispatchEvent(event)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  return (
    <ErrorBoundary component="EditorPanel">
      {config.newViz && <Confirm />}
      <button className={displayPanel ? `editor-toggle` : `editor-toggle collapsed`} title={displayPanel ? `Collapse Editor` : `Expand Editor`} onClick={() => setDisplayPanel(!displayPanel) }></button>
      <section className={displayPanel ? 'editor-panel' : 'hidden editor-panel'}>
        <h2>Configure Chart</h2>
        <section className="form-container">
          <form>
            <Accordion allowZeroExpanded={true}>
              <AccordionItem> {/* General */}
                <AccordionItemHeading>
                  <AccordionItemButton>
                    General
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  <Select value={config.visualizationType} fieldName="visualizationType" label="Chart Type" updateField={updateField} options={['Pie', 'Line', 'Bar', 'Combo']} />
                  {config.visualizationType === "Bar" && <Select value={config.visualizationSubType || "Regular"} fieldName="visualizationSubType" label="Chart Subtype" updateField={updateField} options={['regular', 'stacked', 'horizontal']} />}
                  <TextField value={config.title} fieldName="title" label="Title" updateField={updateField} />
                  <TextField type="textarea" value={config.description} fieldName="description" label="Description" updateField={updateField} />
                  <TextField type="number" value={config.height} fieldName="height" label="Chart Height" updateField={updateField} />
                </AccordionItemPanel>
              </AccordionItem>
              {config.visualizationType !== "Pie" && <AccordionItem>
                <AccordionItemHeading>
                  <AccordionItemButton>
                    Data Series
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  {config.seriesKeys && (
                    <>
                      <label><span className="edit-label">Displaying</span></label>
                      <ul className="series-list">
                        {config.seriesKeys.map((key, i) => {
                          if(config.visualizationType === "Combo") {
                            let changeType = (value) => {
                                let lineSeriesKeys = config.lineSeriesKeys || []
                                let barSeriesKeys = config.barSeriesKeys || []

                                // Remove the values first
                                if( lineSeriesKeys.includes(key) ) {
                                  let index = lineSeriesKeys.indexOf(key)
                                  lineSeriesKeys.splice(index, 1)
                                }

                                if( barSeriesKeys.includes(key) ) {
                                  let index = barSeriesKeys.indexOf(key)
                                  barSeriesKeys.splice(index, 1)
                                }

                                // Add value to new appropriate array
                                if(value === "Bar") {
                                  barSeriesKeys.push(key)
                                } else if(value === "Line") {
                                  lineSeriesKeys.push(key)
                                }

                                updateConfig({...config, barSeriesKeys, lineSeriesKeys})
                            }

                            let determineValue = () => {
                              if(config.lineSeriesKeys.includes(key)) {
                                return "Line"
                              }

                              return "Bar"
                            }
                            let typeDropdown = (
                              <select value={determineValue() || ""} onChange={(event) => { changeType(event.target.value) }} style={{width: "100px", marginRight: "10px"}}>
                                <option value="" default>Select</option>
                                <option value="Bar">Bar</option>
                                <option value="Line">Line</option>
                              </select>
                            )

                            return (<li key={key}>{key} <span>{typeDropdown} <span onClick={() => removeSeriesKey(i)}>X</span></span></li>)
                          }
                          return (<li key={key}>{key} <span onClick={() => removeSeriesKey(i)}>X</span></li>)
                        })}
                      </ul>
                    </>)}
                    <Select value={addSeries || ""} fieldName="visualizationType" label="Add Data Series" initial="Select" onChange={(e) => { setAddSeries(e.target.value)}} options={getColumns()} />
                    <button onClick={(e) => { e.preventDefault(); addNewSeries(addSeries) }} className="btn btn-primary">Add Data Series</button>
                    {config.seriesKeys && config.seriesKeys.length <= 1 && config.visualizationType === "Bar" && (
                      <>
                        <span className="divider-heading">Confidence Keys</span>
                        <Select value={config.confidenceKeys.upper || ""} section="confidenceKeys" fieldName="upper" label="Upper" updateField={updateField} initial="Select" options={getColumns()} />
                        <Select value={config.confidenceKeys.lower || ""} section="confidenceKeys" fieldName="lower" label="Lower" updateField={updateField} initial="Select" options={getColumns()} />
                      </>
                    )}
                </AccordionItemPanel>
              </AccordionItem>}
              <AccordionItem>
                <AccordionItemHeading>
                  <AccordionItemButton>
                    Y Axis
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  <Select value={config.yAxis.dataKey || ""} section="yAxis" fieldName="dataKey" label="Data Key" initial="Select" updateField={updateField} options={getColumns(false)} />
                  {config.visualizationType !== "Pie" && (
                    <>
                      <TextField value={config.yAxis.label} section="yAxis" fieldName="label" label="Label" updateField={updateField} /> 
                      <TextField value={config.yAxis.numTicks} placeholder="Auto" type="number" section="yAxis" fieldName="numTicks" label="Number of ticks" className="number-narrow" updateField={updateField} />
                      <TextField value={config.yAxis.size} type="number" section="yAxis" fieldName="size" label="Size (width)" className="number-narrow" updateField={updateField} />
                      <CheckBox value={config.yAxis.gridLines} section="yAxis" fieldName="gridLines" label="Display Gridlines" updateField={updateField} />
                    </>
                  )}
                  <span className="divider-heading">Number Formatting</span>
                  <CheckBox value={config.dataFormat.commas} section="dataFormat" fieldName="commas" label="Add commas" updateField={updateField} />
                  <TextField value={config.dataFormat.roundTo} type="number" section="dataFormat" fieldName="roundTo" label="Round to decimal point" className="number-narrow" updateField={updateField} />
                  <div className="two-col-inputs">
                    <TextField value={config.dataFormat.prefix} section="dataFormat" fieldName="prefix" label="Prefix" updateField={updateField} />
                    <TextField value={config.dataFormat.suffix} section="dataFormat" fieldName="suffix" label="Suffix" updateField={updateField} />
                  </div>
                </AccordionItemPanel>
              </AccordionItem>
              <AccordionItem>
                <AccordionItemHeading>
                  <AccordionItemButton>
                    X Axis
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  <Select value={config.xAxis.dataKey || ""} section="xAxis" fieldName="dataKey" label="Data Key" initial="Select" updateField={updateField} options={getColumns(false)} />
                  {config.visualizationType !== 'Pie' && (
                    <>
                      <TextField value={config.xAxis.label} section="xAxis" fieldName="label" label="Label" updateField={updateField} />
                      <Select value={config.xAxis.type} section="xAxis" fieldName="type" label="Data Type" updateField={updateField} options={['categorical', 'date']} />
                      {config.xAxis.type === "date" && (
                        <>
                          <p style={{padding: '.5em 0', fontSize: '.9rem', lineHeight: '1rem'}}>Format how charts should parse and display your dates using <a href="https://github.com/d3/d3-time-format#locale_format" target="_blank">these guidelines</a>.</p>
                          <TextField value={config.xAxis.dateParseFormat} section="xAxis" fieldName="dateParseFormat" placeholder="Ex. %Y-%m-%d" label="Date Parse Format" updateField={updateField} />
                          <TextField value={config.xAxis.dateDisplayFormat} section="xAxis" fieldName="dateDisplayFormat" placeholder="Ex. %Y-%m-%d" label="Date Display Format" updateField={updateField} />
                        </>
                      )}
                      <TextField value={config.xAxis.size} type="number" section="xAxis" fieldName="size" label="Size (height)" className="number-narrow" updateField={updateField} />
                      <TextField value={config.xAxis.tickRotation} type="number" section="xAxis" fieldName="tickRotation" label="Tick rotation (Degrees)" className="number-narrow" updateField={updateField} /> 
                    </>
                  )}                 
                </AccordionItemPanel>
              </AccordionItem>
              {config.visualizationType !== 'Pie' && <AccordionItem>
                <AccordionItemHeading>
                  <AccordionItemButton>
                    Regions
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  <Regions config={config} updateConfig={updateConfig} />
                </AccordionItemPanel>
              </AccordionItem> }
              <AccordionItem>
                <AccordionItemHeading>
                  <AccordionItemButton>
                    Legend
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  <CheckBox value={config.legend.hide} section="legend" fieldName="hide" label="Hide Legend" updateField={updateField} />
                  <Select value={config.legend.behavior} section="legend" fieldName="behavior" label="Legend Behavior (When clicked)" updateField={updateField} options={['highlight', 'isolate']} />
                  <TextField value={config.legend.label} section="legend" fieldName="label" label="Title" updateField={updateField} />
                  <Select value={config.legend.position} section="legend" fieldName="position" label="Position" updateField={updateField} options={['right', 'left']} />
                </AccordionItemPanel>
              </AccordionItem>
              <AccordionItem>
                <AccordionItemHeading>
                  <AccordionItemButton>
                    Visual
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  <Select value={config.fontSize} fieldName="fontSize" label="Font Size" updateField={updateField} options={['small', 'medium', 'large']} />
                  <label className="header">
                    <span className="edit-label">Header Theme</span>
                    <ul className="color-palette">
                      {headerColors.map( (palette) => (
                        <li title={ palette } key={ palette } onClick={ () => { updateConfig({...config, theme: palette})}} className={ config.theme === palette ? "selected " + palette : palette}>
                        </li>
                      ))}
                    </ul>
                  </label>
                  <label>
                    <span className="edit-label">Chart Color Palette</span>
                  </label>
                  <h5>Quantitative</h5>
                  <ul className="color-palette">
                    {Object.keys(colorPalettes).filter((name) => name.includes('qualitative')).map( (palette) => {

                      const colorOne = {
                        backgroundColor: colorPalettes[palette][2]
                      }

                      const colorTwo = {
                        backgroundColor: colorPalettes[palette][4]
                      }

                      const colorThree = {
                        backgroundColor: colorPalettes[palette][6]
                      }

                      return (
                          <li title={ palette } key={ palette } onClick={ () => { updateConfig({...config, palette}) }} className={ config.palette === palette ? "selected" : ""}>
                            <span style={colorOne}></span>
                            <span  style={colorTwo}></span>
                            <span  style={colorThree}></span>
                          </li>
                      )
                    })}
                  </ul>
                  <h5>Sequential</h5>
                  <ul className="color-palette">
                    {Object.keys(colorPalettes).filter((name) => name.includes('sequential')).map( (palette) => {

                      const colorOne = {
                        backgroundColor: colorPalettes[palette][2]
                      }

                      const colorTwo = {
                        backgroundColor: colorPalettes[palette][3]
                      }

                      const colorThree = {
                        backgroundColor: colorPalettes[palette][5]
                      }

                      return (
                          <li title={ palette } key={ palette } onClick={ () => { updateConfig({...config, palette}) }} className={ config.palette === palette ? "selected" : ""}>
                            <span style={colorOne}></span>
                            <span  style={colorTwo}></span>
                            <span  style={colorThree}></span>
                          </li>
                      )
                    })}
                  </ul>
                  {config.visualizationType !== 'Pie' && (
                    <> 
                      {config.visualizationSubType !== 'horizontal' && 
                        <CheckBox value={config.labels} fieldName="labels" label="Display label on data" updateField={updateField} />
                      }
                      <TextField value={config.dataCutoff} type="number" fieldName="dataCutoff" className="number-narrow" label="Data Cutoff" updateField={updateField} />
                    </>
                  )}
                  {( config.visualizationType === "Bar" || config.visualizationType === "Combo" ) && <TextField value={config.barThickness} type="number" fieldName="barThickness" label="Bar Thickness" updateField={updateField} />}
                </AccordionItemPanel>
              </AccordionItem>
              <AccordionItem>
                <AccordionItemHeading>
                  <AccordionItemButton>
                    Data Table
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  <CheckBox value={config.table.expanded} section="table" fieldName="expanded" label="Expanded by Default" updateField={updateField} />
                  <CheckBox value={config.table.download} section="table" fieldName="download" label="Display Download Button" updateField={updateField} />
                  <TextField value={config.table.label} section="table" fieldName="label" label="Label" updateField={updateField} />
                </AccordionItemPanel>
              </AccordionItem>
           </Accordion>
          </form>
        </section>
      </section>
    </ErrorBoundary>
  )
})

export default EditorPanel;