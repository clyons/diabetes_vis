var WeekHeatmap = function(svg) {
  this.svg = svg
  this.container = svg
      .append("svg:g")
      .attr("class", "weekHeatmap")

  this.margin = {
    top: 40,
    right: 10,
    bottom: 40,
    left: 60
  }

  this.tileMargin = {
    top: 3,
    middle: 3,
    bottom: 3,
  }


  this.interval = 10
  // Multiply by hours in day
  this.width = (WeekHeatmap.TILE.WIDTH + this.tileMargin.middle) * 24

  // Multiply by days in week
  this.height = (WeekHeatmap.TILE.HEIGHT + this.tileMargin.top + this.tileMargin.bottom) * 7 +
      this.margin.top

  this.x = this.xScale()

  this.y = d3.scale.ordinal()
      .rangePoints([this.margin.top, this.height - this.margin.bottom])
      .domain(WeekHeatmap.DAYS)

  this.data = undefined

  this.hours = new Array(24 * 7)

  for (var i = 0; i < this.hours.length; i++) {
    this.hours[i] = WeekHeatmap.DAYS[parseInt(i / 24)]
  }

  this.currentDate = undefined
  this.daySeries = new DaySeries(svg)
  d3.select("#" + this.daySeries.id)
      .attr("transform", "translate(0, " + this.height + ")")

}

WeekHeatmap.DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
]

WeekHeatmap.TILE = {
  WIDTH: 30,
  HEIGHT: 30
}

WeekHeatmap.prototype.xScale = function() {
  var x = {}
  for (var i = 0; i < 24; i ++) {
    var start = (i * (this.tileMargin.middle + WeekHeatmap.TILE.WIDTH)) + this.margin.left
    x[i] = d3.scale.linear()
        .domain([0, 60])
        .range([start, start + WeekHeatmap.TILE.WIDTH])
  }
  return x
}

/*
 * #render
 * data =
 * {
 *   data: [{ glucose: <value>, time: <total minutes>, day: <day> }, ...],
 *   interval: <number based on sampling [0, 60] (5 would mean 5 minutes between each sample)>
 *   days: [ { day: monday, date: <date> }, ...]
 * }
 *
 * This function should only be called once. If you need to make changes to the graph use #update
 */
WeekHeatmap.prototype.render = function(data) {
  this.daySeries.loadData(window.Utility.dateToString(this.currentDate))

  this.data = data.data
  this.weekDates = data.week_dates
  this.interval = data.interval

  if (!this.data)
    console.log("Alert no data to render graph")

  var that = this

  this.container
    .selectAll(".slice")
    .data(this.data)
    .enter()
    .append("rect")
    .attr("class", "slice")
    .attr("x", function(d, i) {
      return this.x[parseInt(d.time / 60)](d.time % 60)
    }.bind(this))
    .attr("y", function(d) {
      return this.y(d.day) + .5
    }.bind(this))
    .attr("height", WeekHeatmap.TILE.HEIGHT - 1)
    .attr("width", WeekHeatmap.TILE.WIDTH / (60 / this.interval))
    .style("fill", function(d) {
      return window.Utility.getGlucoseColor(d.glucose)
    })
    .on("mouseover", function(d) {
      if (d.day !== WeekHeatmap.getDayFromDate(that.currentDate))
        return

      var slice = d3.select(this)

      slice.style("stroke", "black")
          .style("stroke-width", "1px")

      that.daySeries.highlightFromDate(d.timestamp)
    })
    .on("mouseout", function(d) {
      var slice = d3.select(this)

      slice.style("stroke", "none")
    })

  this.container
      .selectAll(".tile")
      .data(this.hours)
      .enter()
      .append("rect")
      .attr("class", "tile")
      .attr("x", function(d, i) {
        return this.x[parseInt(i % 24)](0)
      }.bind(this))
      .attr("y", function(d, i) {
        return this.y(d)
      }.bind(this))
      .attr("width", WeekHeatmap.TILE.WIDTH)
      .attr("height", WeekHeatmap.TILE.HEIGHT)
      .attr("rx", 4)
      .attr("ry", 4)

  var daySelectionMargin = 3

  this.container
      .selectAll(".daySelection")
      .data(this.weekDates)
      .enter()
      .append("rect")
      .attr("class", function(d) {
        var clazz = "daySelection"
        if (d.day === WeekHeatmap.getDayFromDate(this.currentDate))
          clazz += " selected"
        return clazz
      }.bind(this))
      .attr("x", function(d) {
        return this.x[0](0) - daySelectionMargin
      }.bind(this))
      .attr("y", function(d) {
        return this.y(d.day) - daySelectionMargin
      }.bind(this))
      .attr("width", this.width + (2 * daySelectionMargin))
      .attr("height", WeekHeatmap.TILE.HEIGHT + (2 * daySelectionMargin))
      .attr("rx", daySelectionMargin)
      .attr("ry", daySelectionMargin)
      .on("mouseover", function(d) {
        if (d.day !== WeekHeatmap.getDayFromDate(this.currentDate))
          that.daySeries.highlightRemove()
      }.bind(this))
      .on("click", function(d) {

        d3.select(".daySelection.selected").classed("selected", false)
        d3.select(this).classed("selected", true)

        that.daySeries.loadData(window.Utility.dateToString(new Date(d.date)), undefined,
            that.daySeries.update.bind(that.daySeries))
      })

  this.container
      .selectAll(".y.axis")
      .data(WeekHeatmap.DAYS)
      .enter()
      .append("text")
      .attr("class", "y axis")
      .attr("y", function(d) {
        return this.y(d) + (WeekHeatmap.TILE.HEIGHT / 2)
      }.bind(this))
      .attr("x", 0)
      .attr("text-anchor", "right")
      .attr("dy", ".35em") // vertical-align: middle
      .text(String)

  this.container
      .selectAll(".x.axis")
      .data(new Array(24))
      .enter()
      .append("text")
      .attr("class", "x axis")
      .attr("y", this.margin.top - 4)
      .attr("x", function(d, i) {
        return this.x[i](0) + (WeekHeatmap.TILE.WIDTH / 2)
      }.bind(this))
      .attr("text-anchor", "middle")
      .text(function(d, i) {
        var t = i % 12
        if (t === 0)
          t = 12
        t = i > 11 ? t + "pm" : t + "am"
        return t
      })



}

WeekHeatmap.prototype.loadData = function(date, callback) {
  if (!callback) {
    callback = this.render.bind(this)
  }

  this.currentDate = window.Utility.stringToDate(date)

  $.ajax({
    url: "/diabetes/week",
    type: "GET",
    data: { date: date,
            interval: this.interval },
    success: function(data) {
      callback(data)
    }
  })
}

WeekHeatmap.getDayFromDate = function(date) {
  var day = date.getUTCDay() - 1
  // Adjust for starting the week on monday
  if (day < 0)
    day = WeekHeatmap.DAYS.length - 1
  return WeekHeatmap.DAYS[day]
}
