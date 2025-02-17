import { scaleBand, scaleLinear, scaleLog, scalePoint, scaleTime } from '@visx/scale'
import { useContext } from 'react'
import ConfigContext from '../ConfigContext'
// TODO move props in

const useScales = properties => {
  let { xAxisDataMapped, xMax, yMax, min, max, config, data } = properties
  const { rawData, dimensions } = useContext(ConfigContext)

  const [screenWidth, screenHeight] = dimensions
  const seriesDomain = config.runtime.barSeriesKeys || config.runtime.seriesKeys
  const xAxisType = config.runtime.xAxis.type
  const isHorizontal = config.orientation === 'horizontal'

  const { visualizationType } = config

  //  define scales
  let xScale = null
  let yScale = null
  let g2xScale = null
  let g1xScale = null
  let seriesScale = null
  let xScaleNoPadding = null

  const scaleTypes = {
    TIME: 'time',
    LOG: 'log',
    POINT: 'point',
    LINEAR: 'linear',
    BAND: 'band'
  }

  // handle  Horizontal bars
  if (isHorizontal) {
    xScale = composeXScale({ min: min * 1.03, ...properties })
    xScale.type = config.useLogScale ? scaleTypes.LOG : scaleTypes.LINEAR
    yScale = getYScaleFunction(xAxisType, xAxisDataMapped)
    yScale.rangeRound([0, yMax])
    seriesScale = composeScalePoint(seriesDomain, [0, yMax])
  }

  // handle  Vertical bars
  if (!isHorizontal) {
    xScale = composeScalePoint(xAxisDataMapped, [0, xMax], 0.5)
    xScale.type = scaleTypes.POINT
    yScale = composeYScale(properties)
    seriesScale = composeScalePoint(seriesDomain, [0, xMax])
  }

  // handle Area chart
  if (config.xAxis.type === 'date' && config.xAxis.sortDates) {
    xScale = scaleTime({
      domain: [Math.min(...xAxisDataMapped), Math.max(...xAxisDataMapped)],
      range: [0, xMax]
    })
    xScale.type = scaleTypes.LINEAR
  }

  // handle Deviation bar
  if (config.visualizationType === 'Deviation Bar') {
    const leftOffset = config.isLollipopChart ? 1.05 : 1.03
    yScale = scaleBand({
      domain: xAxisDataMapped,
      range: [0, yMax]
    })
    xScale = scaleLinear({
      domain: [min * leftOffset, Math.max(Number(config.xAxis.target), max)],
      range: [0, xMax],
      round: true,
      nice: true
    })
    xScale.type = scaleTypes.LINEAR
  }

  // handle Scatter plot
  if (config.visualizationType === 'Scatter Plot') {
    if (config.xAxis.type === 'continuous') {
      xScale = scaleLinear({
        domain: [0, Math.max.apply(null, xScale.domain())],
        range: [0, xMax]
      })
      xScale.type = scaleTypes.LINEAR
    }
  }

  // handle Box plot
  if (visualizationType === 'Box Plot') {
    const allOutliers = []
    const hasOutliers = config.boxplot.plots.map(b => b.columnOutliers.map(outlier => allOutliers.push(outlier))) && !config.boxplot.hideOutliers

    // check if outliers are lower
    if (hasOutliers) {
      let outlierMin = Math.min(...allOutliers)
      let outlierMax = Math.max(...allOutliers)

      // check if outliers exceed standard bounds
      if (outlierMin < min) min = outlierMin
      if (outlierMax > max) max = outlierMax
    }

    // check fences for max/min
    let lowestFence = Math.min(...config.boxplot.plots.map(item => item.columnLowerBounds))
    let highestFence = Math.max(...config.boxplot.plots.map(item => item.columnUpperBounds))

    if (lowestFence < min) min = lowestFence
    if (highestFence > max) max = highestFence

    // Set Scales
    yScale = scaleLinear({
      range: [yMax, 0],
      round: true,
      domain: [min, max]
    })

    xScale = scaleBand({
      range: [0, xMax],
      round: true,
      domain: config.boxplot.categories,
      padding: 0.4
    })
    xScale.type = scaleTypes.BAND
  }

  // handle Paired bar
  if (visualizationType === 'Paired Bar') {
    const offset = 1.02 // Offset of the ticks/values from the Axis
    let groupOneMax = Math.max.apply(
      Math,
      data.map(d => d[config.series[0]?.dataKey])
    )
    let groupTwoMax = Math.max.apply(
      Math,
      data.map(d => d[config.series[1]?.dataKey])
    )

    // group one
    g1xScale = scaleLinear({
      domain: [0, Math.max(groupOneMax, groupTwoMax) * offset],
      range: [xMax / 2, 0]
    })

    // group 2
    g2xScale = scaleLinear({
      domain: g1xScale.domain(),
      range: [xMax / 2, xMax],
      nice: true
    })
  }

  if (visualizationType === 'Forest Plot') {
    const resolvedYRange = () => {
      if (config.forestPlot.regression.showDiamond || config.forestPlot.regression.description) {
        return [0 + config.forestPlot.rowHeight * 2, yMax - config.forestPlot.rowHeight]
      } else {
        return [0 + config.forestPlot.rowHeight * 2, yMax]
      }
    }

    yScale = scaleLinear({
      domain: [0, rawData.length],
      range: resolvedYRange()
    })

    const xAxisPadding = 5

    const leftWidthOffset = (Number(config.forestPlot.leftWidthOffset) / 100) * xMax
    const rightWidthOffset = (Number(config.forestPlot.rightWidthOffset) / 100) * xMax

    const rightWidthOffsetMobile = (Number(config.forestPlot.rightWidthOffsetMobile) / 100) * xMax
    const leftWidthOffsetMobile = (Number(config.forestPlot.leftWidthOffsetMobile) / 100) * xMax

    if (screenWidth > 480) {
      xScale = scaleLinear({
        domain: [Math.min(...data.map(d => parseFloat(d[config.forestPlot.lower]))) - xAxisPadding, Math.max(...data.map(d => parseFloat(d[config.forestPlot.upper]))) + xAxisPadding],
        range: [leftWidthOffset, xMax - rightWidthOffset],
        type: 'linear'
      })
    } else {
      xScale = scaleLinear({
        domain: [Math.min(...data.map(d => parseFloat(d[config.forestPlot.lower]))) - xAxisPadding, Math.max(...data.map(d => parseFloat(d[config.forestPlot.upper]))) + xAxisPadding],
        range: [leftWidthOffsetMobile, xMax - rightWidthOffsetMobile],
        type: 'linear'
      })
    }
  }

  return { xScale, yScale, seriesScale, g1xScale, g2xScale, xScaleNoPadding }
}

export default useScales

/// helper functions
const composeXScale = ({ min, max, xMax, config }) => {
  // Adjust min value if using logarithmic scale
  min = config.useLogScale && min >= 0 && min < 1 ? min + 0.1 : min
  // Select the appropriate scale function
  const scaleFunc = config.useLogScale ? scaleLog : scaleLinear
  // Return the configured scale function
  return scaleFunc({
    domain: [min, max],
    range: [0, xMax],
    nice: config.useLogScale,
    zero: config.useLogScale,
    type: config.useLogScale ? 'log' : 'linear'
  })
}

const composeYScale = ({ min, max, yMax, config }) => {
  // Adjust min value if using logarithmic scale
  min = config.useLogScale && min >= 0 && min < 1 ? min + 0.1 : min
  // Select the appropriate scale function
  const scaleFunc = config.useLogScale ? scaleLog : scaleLinear
  // Return the configured scale function
  return scaleFunc({
    domain: [min, max],
    range: [yMax, 0],
    nice: config.useLogScale,
    zero: config.useLogScale
  })
}

const getYScaleFunction = (xAxisType, xAxisDataMapped) => {
  if (xAxisType === 'date') {
    return scaleLinear({
      domain: [Math.min(...xAxisDataMapped), Math.max(...xAxisDataMapped)]
    })
  } else {
    return scalePoint({ domain: xAxisDataMapped, padding: 0.5 })
  }
}

const composeScalePoint = (domain, range, padding = 0) => {
  return scalePoint({
    domain: domain,
    range: range,
    padding: padding,
    type: 'point'
  })
}
