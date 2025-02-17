import React, { useContext, useEffect } from 'react'
import ConfigContext from '../ConfigContext'

export const useBarChart = () => {
  const { config, colorPalettes, tableData, updateConfig, parseDate, formatDate } = useContext(ConfigContext)
  const { orientation } = config

  const isHorizontal = orientation === 'horizontal'
  const barBorderWidth = 1
  const lollipopBarWidth = config.lollipopSize === 'large' ? 7 : config.lollipopSize === 'medium' ? 6 : 5
  const lollipopShapeSize = config.lollipopSize === 'large' ? 14 : config.lollipopSize === 'medium' ? 12 : 10
  const isLabelBelowBar = config.yAxis.labelPlacement === 'Below Bar'
  const displayNumbersOnBar = config.yAxis.displayNumbersOnBar
  const section = config.orientation === 'horizontal' ? 'yAxis' : 'xAxis'

  const isRounded = config.barStyle === 'rounded'
  const isStacked = config.visualizationSubType === 'stacked'
  const tipRounding = config.tipRounding
  const radius = config.roundingStyle === 'standard' ? '8px' : config.roundingStyle === 'shallow' ? '5px' : config.roundingStyle === 'finger' ? '15px' : '0px'
  const stackCount = config.runtime.seriesKeys.length
  const fontSize = { small: 16, medium: 18, large: 20 }
  const hasMultipleSeries = Object.keys(config.runtime.seriesLabels).length > 1

  useEffect(() => {
    if (orientation === 'horizontal' && !config.yAxis.labelPlacement) {
      updateConfig({
        ...config,
        yAxis: {
          ...config,
          labelPlacement: 'Below Bar'
        }
      })
    }
  }, [config, updateConfig]) // eslint-disable-line

  useEffect(() => {
    if (config.isLollipopChart === false && config.barHeight < 25) {
      updateConfig({ ...config, barHeight: 25 })
    }
  }, [config.isLollipopChart]) // eslint-disable-line

  useEffect(() => {
    if (config.visualizationSubType === 'horizontal') {
      updateConfig({
        ...config,
        orientation: 'horizontal'
      })
    }
  }, []) // eslint-disable-line

  useEffect(() => {
    if (config.barStyle === 'lollipop' && !config.isLollipopChart) {
      updateConfig({ ...config, isLollipopChart: true })
    }
    if (isRounded || config.barStyle === 'flat') {
      updateConfig({ ...config, isLollipopChart: false })
    }
  }, [config.barStyle]) // eslint-disable-line

  const applyRadius = index => {
    if (index === undefined || index === null || !isRounded) return {}
    let style = {}

    if ((isStacked && index + 1 === stackCount) || !isStacked) {
      style = isHorizontal ? { borderRadius: `0 ${radius}  ${radius}  0` } : { borderRadius: `${radius} ${radius} 0 0` }
    }
    if (!isStacked && index === -1) {
      style = isHorizontal ? { borderRadius: `${radius} 0  0 ${radius} ` } : { borderRadius: ` 0  0 ${radius} ${radius}` }
    }
    if (tipRounding === 'full' && isStacked && index === 0 && stackCount > 1) {
      style = isHorizontal ? { borderRadius: `${radius} 0 0 ${radius}` } : { borderRadius: `0 0 ${radius} ${radius}` }
    }
    if (tipRounding === 'full' && ((isStacked && index === 0 && stackCount === 1) || !isStacked)) {
      style = { borderRadius: radius }
    }
    return style
  }

  const assignColorsToValues = (barsCount, barIndex, currentBarColor) => {
    if (!config.legend.colorCode && config.series.length > 1) {
      return currentBarColor
    }
    const palettesArr = config.customColors ?? colorPalettes[config.palette]
    const values = tableData.map(d => {
      return d[config.legend.colorCode]
    })
    // Map to hold unique values and their  colors
    let colorMap = new Map()
    // Resultant array to hold colors  to the values
    let palette = []

    for (let i = 0; i < values.length; i++) {
      // If value not in map, add it and assign a color
      if (!colorMap.has(values[i])) {
        colorMap.set(values[i], palettesArr[colorMap.size % palettesArr.length])
      }
      // push the color to the result array
      palette.push(colorMap.get(values[i]))
    }

    // loop throghy existing colors and extend if needed
    while (palette.length < barsCount) {
      palette = palette.concat(palette)
    }
    const barColor = palette[barIndex]
    return barColor
  }
  const updateBars = defaultBars => {
    // function updates  stacked && regular && lollipop horizontal bars
    if (config.visualizationType !== 'Bar' && !isHorizontal) return defaultBars

    const barsArr = [...defaultBars]
    let barHeight

    const heights = {
      stacked: config.barHeight,
      lollipop: lollipopBarWidth
    }

    if (!isStacked) {
      barHeight = heights[config.isLollipopChart ? 'lollipop' : 'stacked'] * stackCount
    } else {
      barHeight = heights.stacked
    }

    const labelHeight = isLabelBelowBar ? fontSize[config.fontSize] * 1.2 : 0
    let barSpace = Number(config.barSpace)

    // calculate height of container based height, space and fontSize of labels
    let totalHeight = barsArr.length * (barHeight + labelHeight + barSpace)

    if (isHorizontal) {
      config.heights.horizontal = totalHeight
    }

    // return new updated bars/groupes
    return barsArr.map((bar, i) => {
      // set bars Y dynamically to handle space between bars
      let y = 0
      bar.index !== 0 && (y = (barHeight + barSpace + labelHeight) * i)

      return { ...bar, y: y, height: barHeight }
    })
  }

  const getHighlightedBarColorByValue = value => {
    const match = config?.highlightedBarValues.filter(item => {
      if (!item.value) return
      return config.xAxis.type === 'date' ? formatDate(parseDate(item.value)) === value : item.value === value
    })[0]

    if (!match?.color) return `rgba(255, 102, 1)`
    return match.color
  }
  const getHighlightedBarByValue = value => {
    const match = config?.highlightedBarValues.filter(item => {
      if (!item.value) return
      return config.xAxis.type === 'date' ? formatDate(parseDate(item.value)) === value : item.value === value
    })[0]

    if (!match?.color) return false
    return match
  }

  return {
    isHorizontal,
    barBorderWidth,
    lollipopBarWidth,
    lollipopShapeSize,
    isLabelBelowBar,
    displayNumbersOnBar,
    section,
    isRounded,
    isStacked,
    tipRounding,
    radius,
    stackCount,
    fontSize,
    hasMultipleSeries,
    applyRadius,
    updateBars,
    assignColorsToValues,
    getHighlightedBarColorByValue,
    getHighlightedBarByValue
  }
}
