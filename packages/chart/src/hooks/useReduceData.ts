function useReduceData(config, data) {
  // for combo charts check if all  Data Series selected to Bar;
  const isBar = config?.series?.every(element => element?.type === 'Bar')
  // for combo charts check if all Data series selected Line or dashed-md/sm/lg.
  const isAllLine = config?.series?.every(el => el.type === 'Line' || el.type === 'dashed-sm' || el.type === 'dashed-md' || el.type === 'dashed-lg')
  const isNumber = value => {
    //console.log("useReduce isNumber val,type ", value, typeof value);
    value = cleanChars(value) // clean first
    if (typeof value === 'string') {
      return value !== null && value !== '' && /\d+\.?\d*/.test(value)
    }
    // just in case data has type number we need this
    if (typeof value === 'number') {
      return !Number.isNaN(value)
    }
    return false // because if it gets here something is wrong
  }
  const isNumberLog = value => {
    //console.log("entering isNumberLog valuetype is:",typeof value);
    value = cleanChars(value) // clean first
    // last test checks for 1 or more digits, optional decimal, 0 or more optional digits
    var test = value != null && value !== '' && /\d+\.?\d*/.test(value)
    // so typeof value === 'number' does not work
    if (test === false) {
      console.log('# isNUmberLog FALSE on value, result', value, test)
    } else {
      console.log('# isNUmberLog TRUE on value, result', value, test)
    }
    if (typeof value === 'string') {
      return value !== null && value !== '' && /\d+\.?\d*/.test(value)
    }
    // just in case data has type number we need this
    if (typeof value === 'number') {
      return !Number.isNaN(value)
    }
    return false // if we get here its not a string or a number so something else
    //value != null && value !== '' && /[\d]/.test(value) && !Number.isNaN(value)
  }
  const cleanChars = value => {
    // remove comma and $ signs
    return value != null && value != '' ? value.replace(/[,\$]/g, '') : ''
  }
  const getMaxValueFromData = () => {
    let max // will hold max number from data.
    if ((config.visualizationType === 'Bar' || (config.visualizationType === 'Combo' && isBar)) && config.visualizationSubType === 'stacked') {
      const yTotals = data.reduce((allTotals, xValue) => {
        const totalYValues = config.runtime.seriesKeys.reduce((yTotal, k) => {
          yTotal += Number(xValue[k])
          return yTotal
        }, 0)

        allTotals.push(totalYValues)
        if (totalYValues > max) {
          max = totalYValues
        }
        return allTotals
      }, [] as number[])

      max = Math.max(...yTotals)
    } else if (config.visualizationType === 'Bar' && config.series && config.series.dataKey) {
      max = Math.max(...data.map(d => (isNumber(cleanChars(d[config.series.dataKey])) ? Number(cleanChars(d[config.series.dataKey])) : 0)))
      //max = Math.max(...data.map(d => Number(d[config.series.dataKey])))
      //Number(d[config.series.dataKey])))
    } else if (config.visualizationType === 'Combo' && config.visualizationSubType === 'stacked' && !isBar) {
      let total = []

      if (config.runtime.barSeriesKeys && config.runtime.lineSeriesKeys) {
        // get barSeries max Values added to each other
        data.map(function (d, index) {
          const totalYValues = config.runtime.barSeriesKeys.reduce((yTotal, k) => {
            yTotal += Number(d[k])
            return yTotal
          }, 0)
          total.push(totalYValues)
        })
        // get lineSeries largest values
        const lineMax = Math.max(...data.map(d => Math.max(...config.runtime.lineSeriesKeys.map(key => Number(cleanChars(d[key]))))))

        const barMax = Math.max(...total)

        max = Number(barMax) > Number(lineMax) ? barMax : lineMax
      }
    } else {
      //console.log("###useReduceData ELSE case")
      max = Math.max(...data.map(d => Math.max(...config.runtime.seriesKeys.map(key => (isNumber(d[key]) ? Number(cleanChars(d[key])) : 0)))))
    }
    console.log('MAX=', max)
    return max
  }

  const getMinValueFromData = () => {
    let min
    const minNumberFromData = Math.min(...data.map(d => Math.min(...config.runtime.seriesKeys.map(key => (isNumber(d[key]) ? Number(cleanChars(d[key])) : 1000000000)))))
    min = String(minNumberFromData)
    console.log('MIN=', min)
    return min
  }

  const findPositiveNum = (): boolean => {
    // loop throught provided data to find positve number in arr based on series keys.
    let existPositiveValue = false
    if (config.runtime.seriesKeys) {
      for (let i = 0; i < config.runtime.seriesKeys.length; i++) {
        existPositiveValue = data.some(d => d[config.runtime.seriesKeys[i]] >= 0)
      }
    }
    return existPositiveValue
  }

  const maxValue = Number(getMaxValueFromData())
  const minValue = Number(getMinValueFromData())
  const existPositiveValue = findPositiveNum()

  return { minValue, maxValue, existPositiveValue, isAllLine }
}

export default useReduceData
