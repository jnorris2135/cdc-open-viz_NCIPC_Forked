import React, { useState, useEffect, useContext } from 'react'

import ConfigContext from '../ConfigContext'
import type { APIFilter } from '../types/APIFilter'
import type { SharedFilter } from '../types/SharedFilter'

import { DataTransform } from '@cdc/core/helpers/DataTransform'
import fetchRemoteData from '@cdc/core/helpers/fetchRemoteData'
import { useGlobalContext } from '@cdc/core/components/GlobalContext'
import Modal from '@cdc/core/components/ui/Modal'
import Tooltip from '@cdc/core/components/ui/Tooltip'
import Icon from '@cdc/core/components/ui/Icon'
import Select from '@cdc/core/components/ui/Select'

type HeaderProps = {
  setPreview?: any
  tabSelected: any
  setTabSelected: any
  back?: any
  subEditor?: any
}

export const FilterBehavior = {
  Apply: 'Apply Button',
  OnChange: 'Filter Change'
}

const Header = (props: HeaderProps) => {
  const { setPreview, tabSelected, setTabSelected, back, subEditor } = props
  const { config, updateConfig, setParentConfig } = useContext(ConfigContext)

  const { overlay } = useGlobalContext()

  const [columns, setColumns] = useState<string[]>([])

  const transform = new DataTransform()

  const changeConfigValue = (parentObj, key, value) => {
    let newConfig = { ...config }
    if (!newConfig[parentObj]) newConfig[parentObj] = {}
    newConfig[parentObj][key] = value

    updateConfig(newConfig)
  }

  const setTab = index => {
    setTabSelected(index)
    if (index === 3) {
      setPreview(true)
    } else {
      setPreview(false)
    }
  }

  const addNewFilter = () => {
    let dashboardConfig = { ...config.dashboard }

    dashboardConfig.sharedFilters = dashboardConfig.sharedFilters || []
    const newFilter: SharedFilter = { key: 'Dashboard Filter ' + (dashboardConfig.sharedFilters.length + 1) }
    dashboardConfig.sharedFilters.push(newFilter)

    updateConfig({ ...config, dashboard: dashboardConfig })
  }

  const removeFilter = index => {
    let dashboardConfig = { ...config.dashboard }
    let visualizations = { ...config.visualizations }

    dashboardConfig.sharedFilters.splice(index, 1)

    Object.keys(visualizations).forEach(vizKey => {
      if (visualizations[vizKey].visualizationType === 'filter-dropdowns' && visualizations[vizKey].hide && visualizations[vizKey].hide.length > 0) {
        if (visualizations[vizKey].hide.indexOf(index) !== -1) {
          visualizations[vizKey].hide.splice(visualizations[vizKey].hide.indexOf(index), 1)
        }
        visualizations[vizKey].hide.forEach((hideIndex, i) => {
          if (hideIndex > index) {
            visualizations[vizKey].hide[i] = hideIndex - 1
          }
        })
      }
    })

    // Ensures URL filters refresh after filter removal
    if (dashboardConfig.datasets) {
      Object.keys(dashboardConfig.datasets).forEach(datasetKey => {
        dashboardConfig.datasets[datasetKey].runtimeDataUrl = ''
      })
    }

    updateConfig({ ...config, visualizations, dashboard: dashboardConfig })

    overlay?.actions.toggleOverlay()
  }

  const convertStateToConfig = (type = 'JSON') => {
    let strippedState = JSON.parse(JSON.stringify(config))
    delete strippedState.newViz
    delete strippedState.runtime

    if (type === 'JSON') {
      return JSON.stringify(strippedState)
    }

    return strippedState
  }

  useEffect(() => {
    const parsedData = convertStateToConfig()

    // Emit the data in a regular JS event so it can be consumed by anything.
    const event = new CustomEvent('updateVizConfig', { detail: parsedData })

    window.dispatchEvent(event)

    // Pass up to Editor if needed
    if (setParentConfig) {
      const newConfig = convertStateToConfig('object')
      setParentConfig(newConfig)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  useEffect(() => {
    const runSetColumns = async () => {
      if (config.filterBehavior === FilterBehavior.Apply) return
      let columns = {}
      let dataKeys = Object.keys(config.datasets)

      for (let i = 0; i < dataKeys.length; i++) {
        let _dataSet = config.datasets[dataKeys[i]]
        if (!_dataSet.data && _dataSet.dataUrl) {
          config.datasets[dataKeys[i]].data = await fetchRemoteData(config.datasets[dataKeys[i]].dataUrl)
          _dataSet = config.datasets[dataKeys[i]]
          if (_dataSet.dataDescription) {
            try {
              config.datasets[dataKeys[i]].data = transform.autoStandardize(_dataSet.data)
              _dataSet = config.datasets[dataKeys[i]]
              config.datasets[dataKeys[i]].data = transform.developerStandardize(_dataSet.data, _dataSet.dataDescription)
              _dataSet = config.datasets[dataKeys[i]]
            } catch (e) {
              //Data not able to be standardized, leave as is
            }
          }
        }

        if (_dataSet.data) {
          config.datasets[dataKeys[i]].data.forEach(row => {
            Object.keys(row).forEach(columnName => (columns[columnName] = true))
          })
        }
      }

      setColumns(Object.keys(columns))
    }

    runSetColumns()
  }, [config.datasets])

  const filterModal = (filter: SharedFilter, index) => {
    const saveChanges = () => {
      let tempConfig = { ...config.dashboard }
      tempConfig.sharedFilters[index] = filter

      updateConfig({ ...config, dashboard: tempConfig })

      overlay?.actions.toggleOverlay()
    }

    const updateFilterProp = (name, index, value) => {
      // @TODO this should be refactored into a reducer function.
      // it's unsafe to directly set objects w/o guardrails
      let newFilter = { ...filter }

      newFilter[name] = value

      overlay?.actions.openOverlay(filterModal(newFilter, index))
    }

    const addFilterUsedBy = (filter, index, value) => {
      if (!filter.usedBy) filter.usedBy = []
      filter.usedBy.push(value)
      updateFilterProp('usedBy', index, filter.usedBy)
    }

    const removeFilterUsedBy = (filter, index, value) => {
      let usedByIndex = filter.usedBy.indexOf(value)
      if (usedByIndex !== -1) {
        filter.usedBy.splice(usedByIndex, 1)
        updateFilterProp('usedBy', index, filter.usedBy)
      }
    }

    const updateAPIFilter = (key: keyof APIFilter, value: string | boolean) => {
      const _filter = filter.apiFilter || { apiEndpoint: '', valueSelector: '', textSelector: '' }
      const newAPIFilter: APIFilter = { ..._filter, [key]: value }
      overlay?.actions.openOverlay(filterModal({ ...filter, apiFilter: newAPIFilter }, index))
    }

    return (
      <Modal>
        <Modal.Content>
          <h2>Dashboard Filter Settings</h2>
          <fieldset className='shared-filter-modal' key={filter.columnName + index}>
            <button
              type='button'
              className='btn btn-primary remove-column'
              onClick={() => {
                removeFilter(index)
              }}
            >
              Remove Filter
            </button>
            <label>
              <span className='edit-label column-heading'>Filter Type: </span>
              <select defaultValue={filter.type || ''} onChange={e => updateFilterProp('type', index, e.target.value)}>
                <option value=''>- Select Option -</option>
                <option value='urlfilter'>URL</option>
                <option value='datafilter'>Data</option>
              </select>
            </label>
            {filter.type === 'urlfilter' && (
              <>
                <label>
                  <span className='edit-label column-heading'>Label: </span>
                  <input
                    type='text'
                    value={filter.key}
                    onChange={e => {
                      updateFilterProp('key', index, e.target.value)
                    }}
                  />
                </label>
                {config.filterBehavior !== FilterBehavior.Apply && (
                  <label>
                    <span className='edit-label column-heading'>URL to Filter: </span>
                    <select defaultValue={filter.datasetKey || ''} onChange={e => updateFilterProp('datasetKey', index, e.target.value)}>
                      <option value=''>- Select Option -</option>
                      {Object.keys(config.datasets).map(datasetKey => {
                        if (config.datasets[datasetKey].dataUrl) {
                          return (
                            <option key={datasetKey} value={datasetKey}>
                              {config.datasets[datasetKey].dataUrl.substring(0, 50)}
                            </option>
                          )
                        }
                        return <React.Fragment key={datasetKey}></React.Fragment>
                      })}
                    </select>
                  </label>
                )}
                <label>
                  <span className='edit-label column-heading'>Query string parameter</span> <input type='text' defaultValue={filter.queryParameter} onChange={e => updateFilterProp('queryParameter', index, e.target.value)} />
                </label>
                <label>
                  <span className='edit-label column-heading'>Filter API Endpoint: </span>
                  <input
                    type='text'
                    value={filter.apiFilter?.apiEndpoint}
                    onChange={e => {
                      updateAPIFilter('apiEndpoint', e.target.value)
                    }}
                  />
                </label>
                <label>
                  <span className='edit-label column-heading'>Text Selector: </span>
                  <input
                    type='text'
                    value={filter.apiFilter?.textSelector}
                    onChange={e => {
                      updateAPIFilter('textSelector', e.target.value)
                    }}
                  />
                </label>
                <label>
                  <span className='edit-label column-heading'>Value Selector: </span>
                  <input
                    type='text'
                    value={filter.apiFilter?.valueSelector}
                    onChange={e => {
                      updateAPIFilter('valueSelector', e.target.value)
                    }}
                  />
                </label>
                <label>
                  <span className='edit-label column-heading'>Parent Filter: </span>
                  <select
                    value={filter.parents || []}
                    onChange={e => {
                      updateFilterProp('parent', index, e.target.value)
                    }}
                  >
                    <option value=''>Select a filter</option>
                    {config.dashboard.sharedFilters &&
                      config.dashboard.sharedFilters.map(sharedFilter => {
                        if (sharedFilter.key !== filter.key && sharedFilter.type !== 'datafilter') {
                          return <option>{sharedFilter.key}</option>
                        }
                      })}
                  </select>
                </label>
                <label>
                  <span className='edit-label column-heading'>Auto Load: </span>
                  <input
                    type='checkbox'
                    checked={filter.apiFilter?.autoLoad}
                    onChange={e => {
                      updateAPIFilter('autoLoad', !filter.apiFilter?.autoLoad)
                    }}
                  />
                </label>
                <label>
                  <span className='edit-label column-heading'>Default Value: </span>
                  <input
                    type='text'
                    value={filter.apiFilter?.defaultValue}
                    onChange={e => {
                      updateAPIFilter('defaultValue', e.target.value)
                    }}
                  />
                </label>
              </>
            )}
            {filter.type === 'datafilter' && (
              <>
                <label>
                  <span className='edit-label column-heading'>Filter: </span>
                  <select
                    value={filter.columnName}
                    onChange={e => {
                      updateFilterProp('columnName', index, e.target.value)
                    }}
                  >
                    <option value=''>- Select Option -</option>
                    {columns.map(dataKey => (
                      <option value={dataKey} key={`filter-column-select-item-${dataKey}`}>
                        {dataKey}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className='edit-label column-heading'>Label: </span>
                  <input
                    type='text'
                    value={filter.key}
                    onChange={e => {
                      updateFilterProp('key', index, e.target.value)
                    }}
                  />
                </label>
                <label>
                  <span className='edit-label column-heading'>Show Dropdown</span>
                  <input
                    type='checkbox'
                    defaultChecked={filter.showDropdown === true}
                    onChange={e => {
                      updateFilterProp('showDropdown', index, !filter.showDropdown)
                    }}
                  />
                </label>
                <label>
                  <span className='edit-label column-heading'>Set By: </span>
                  <select value={filter.setBy} onChange={e => updateFilterProp('setBy', index, e.target.value)}>
                    <option value=''>- Select Option -</option>
                    {Object.keys(config.visualizations).map(vizKey => (
                      <option value={vizKey} key={`set-by-select-item-${vizKey}`}>
                        {config.visualizations[vizKey].general && config.visualizations[vizKey].general.title ? config.visualizations[vizKey].general.title : config.visualizations[vizKey].title || vizKey}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className='edit-label column-heading'>Used By: </span>
                  <ul>
                    {filter.usedBy &&
                      filter.usedBy.map(vizKey => (
                        <li key={`used-by-list-item-${vizKey}`}>
                          <span>{config.visualizations[vizKey].general && config.visualizations[vizKey].general.title ? config.visualizations[vizKey].general.title : config.visualizations[vizKey].title || vizKey}</span>{' '}
                          <button
                            onClick={e => {
                              e.preventDefault()
                              removeFilterUsedBy(filter, index, vizKey)
                            }}
                          >
                            X
                          </button>
                        </li>
                      ))}
                  </ul>
                  <select onChange={e => addFilterUsedBy(filter, index, e.target.value)}>
                    <option value=''>- Select Option -</option>
                    {Object.keys(config.visualizations)
                      .filter(vizKey => filter.setBy !== vizKey && (!filter.usedBy || filter.usedBy.indexOf(vizKey) === -1) && !config.visualizations[vizKey].usesSharedFilter)
                      .map(vizKey => (
                        <option value={vizKey} key={`used-by-select-item-${vizKey}`}>
                          {config.visualizations[vizKey].general && config.visualizations[vizKey].general.title ? config.visualizations[vizKey].general.title : config.visualizations[vizKey].title || vizKey}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span className='edit-label column-heading'>Reset Label: </span>
                  <input
                    type='text'
                    value={filter.resetLabel || ''}
                    onChange={e => {
                      updateFilterProp('resetLabel', index, e.target.value)
                    }}
                  />
                </label>
                <label>
                  <span className='edit-label column-heading'>Parent Filter: </span>
                  <select
                    value={filter.parents || []}
                    onChange={e => {
                      updateFilterProp('parent', index, e.target.value)
                    }}
                  >
                    <option value=''>Select a filter</option>
                    {config.dashboard.sharedFilters &&
                      config.dashboard.sharedFilters.map(sharedFilter => {
                        if (sharedFilter.key !== filter.key && sharedFilter.type !== 'urlfilter') {
                          return <option>{sharedFilter.key}</option>
                        }
                      })}
                  </select>
                </label>
              </>
            )}
          </fieldset>
          <button type='button' className='btn btn-primary' style={{ display: 'inline-block', marginRight: '1em' }} onClick={overlay?.actions.toggleOverlay}>
            Cancel
          </button>
          <button type='button' className='btn btn-primary' style={{ display: 'inline-block' }} onClick={saveChanges}>
            Save
          </button>
        </Modal.Content>
      </Modal>
    )
  }

  return (
    <div aria-level={2} role='heading' className={`editor-heading${subEditor ? ' sub-dashboard-viz' : ''}`}>
      {subEditor ? (
        <div className='heading-1 back-to' onClick={back} style={{ cursor: 'pointer' }}>
          <span>&#8592;</span> Back to Dashboard
        </div>
      ) : (
        <div className='heading-1'>
          Dashboard Editor
          <br />
          {<input type='text' placeholder='Enter Dashboard Name Here' defaultValue={config?.dashboard?.title} onChange={e => changeConfigValue('dashboard', 'title', e.target.value)} />}
        </div>
      )}
      {!subEditor && (
        <div className='toggle-bar__wrapper'>
          <ul className='toggle-bar'>
            <li
              className={tabSelected === 0 ? 'active' : 'inactive'}
              onClick={() => {
                setTab(0)
              }}
            >
              Dashboard Description
            </li>
            <li
              className={tabSelected === 1 ? 'active' : 'inactive'}
              onClick={() => {
                setTab(1)
              }}
            >
              Dashboard Filters
            </li>
            <li
              className={tabSelected === 2 ? 'active' : 'inactive'}
              onClick={() => {
                setTab(2)
              }}
            >
              Data Table Settings
            </li>
            <li
              className={tabSelected === 3 ? 'active' : 'inactive'}
              onClick={() => {
                setTab(3)
              }}
            >
              Dashboard Preview
            </li>
          </ul>
          <div className='heading-body'>
            {tabSelected === 0 && <input type='text' className='description-input' placeholder='Type a dashboard description here.' defaultValue={config?.dashboard?.description} onChange={e => changeConfigValue('dashboard', 'description', e.target.value)} />}
            {tabSelected === 1 && (
              <>
                {config.dashboard.sharedFilters &&
                  config.dashboard.sharedFilters.map((sharedFilter, index) => (
                    <span className='shared-filter-button' key={`shared-filter-${sharedFilter.key}`}>
                      <a
                        href='#'
                        onClick={e => {
                          e.preventDefault()
                          overlay?.actions.openOverlay(filterModal(sharedFilter, index))
                        }}
                      >
                        {sharedFilter.key}
                      </a>
                      <button onClick={() => removeFilter(index)}>X</button>
                    </span>
                  ))}
                <button onClick={addNewFilter}>Add New Filter</button>

                <Select
                  value={config.filterBehavior}
                  fieldName='filterBehavior'
                  label='Filter Behavior'
                  initial='- Select Option -'
                  onchange={e => {
                    updateConfig({ ...config, filterBehavior: e.target.value })
                  }}
                  options={Object.values(FilterBehavior)}
                  tooltip={
                    <Tooltip style={{ textTransform: 'none' }}>
                      <Tooltip.Target>
                        <Icon display='question' base='' size='' color='' style={{ marginLeft: '0.5rem' }} />
                      </Tooltip.Target>
                      <Tooltip.Content>
                        <p>The Apply Button option changes the visualization when the user clicks "apply". The Filter Change option immediately changes the visualization when the selection is changed.</p>
                      </Tooltip.Content>
                    </Tooltip>
                  }
                />
              </>
            )}
            {tabSelected === 2 && (
              <>
                <div className='wrap'>
                  <label>
                    <input type='checkbox' defaultChecked={config.table.show} onChange={e => changeConfigValue('table', 'show', e.target.checked)} />
                    Show Data Table(s)
                  </label>
                  <br />

                  <label>
                    <input type='checkbox' defaultChecked={config.table.expanded} onChange={e => changeConfigValue('table', 'expanded', e.target.checked)} />
                    Expanded by Default
                  </label>
                  <br />
                </div>

                {/* <div className="wrap">
                  <label>
                    <input type='checkbox' defaultChecked={config.table.downloadPdfButton} onChange={e => changeConfigValue('table', 'downloadPdfButton', e.target.checked)} />
                    Show PDF Button
                  </label>
                  <label>
                    <input type='checkbox' defaultChecked={config.table.downloadImageButton} onChange={e => changeConfigValue('table', 'downloadImageButton', e.target.checked)} />
                    Show Image Button
                  </label>
                </div> */}

                <div className='wrap'>
                  <label>
                    <input type='checkbox' defaultChecked={config.table.limitHeight} onChange={e => changeConfigValue('table', 'limitHeight', e.target.checked)} />
                    Limit Table Height
                  </label>
                  {config.table.limitHeight && <input className='table-height-input' type='text' placeholder='Height (px)' defaultValue={config.table.height} onChange={e => changeConfigValue('table', 'height', e.target.value)} />}
                </div>

                <div className='wrap'>
                  <label>
                    <input type='checkbox' defaultChecked={config.table.download} onChange={e => changeConfigValue('table', 'download', e.target.checked)} />
                    Show Download CSV Link
                  </label>
                  <label>
                    <input type='checkbox' defaultChecked={config.table.showDownloadUrl} onChange={e => changeConfigValue('table', 'showDownloadUrl', e.target.checked)} />
                    Show URL to Automatically Updated Data
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Header
