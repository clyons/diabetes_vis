class DiabetesController < ApplicationController
  EPSILON_MINUTES = 60
  DAYS_OF_THE_WEEK = %w[sunday monday tuesday wednesday thursday friday
saturday]

  def dashboard
  end

  def time_series
    @glucose_sensor_data_count = GlucoseSensorData.count
  end

  def day_series
    @date_extent = [
      GlucoseSensorData.minimum(:timestamp).strftime("%Y-%m-%d"),
      GlucoseSensorData.maximum(:timestamp).strftime("%Y-%m-%d")
    ]
  end

  def average_day(time, range)
    day_of_week = time.wday

    #return []

    averages = []

    (0..((60 * 24) - 1)).step(EPSILON_MINUTES) do |n|
      minutes_start = (n % 60).to_s.rjust(2, "0")
      hours_start = (n / 60).to_s.rjust(2, "0")

      # Since between operator is inclusive, we make it 1 second less than the next value
      minutes_end = ((n + EPSILON_MINUTES - 1) % 60).to_s.rjust(2, "0")
      hours_end = ((n + EPSILON_MINUTES - 1) / 60).to_s.rjust(2, "0")

      data = GlucoseSensorData.where("time between #{hours_start}#{minutes_start}00 AND #{hours_end}#{minutes_end}59 and day = #{day_of_week}").between(range[:begin], range[:end], :field => :timestamp)

      #unless range.empty?
      #  data
      #end

      timestamp = Time.utc(time.year, time.month, time.day, hours_start, minutes_start)
      datum = {
        "timestamp" => timestamp.to_s,
        "glucose" => data.average(:glucose)
      }

      averages << datum

    end

    return averages

  end

  def day_averages
    limit = (params[:limit] || 1).to_i

    year, month, day = params[:day].split("-")
    time = Time.utc(year, month, day)

    max = GlucoseSensorData.maximum(:timestamp)
    range = {}
    unless range == "all"
      range = { :begin => max - limit.months, :end => max }
    end


    averages = average_day(time, range)

    render :json => averages.to_json
  end

  # Gets data for given day format will be %Y-%m-%d
  def day
    year, month, day = params[:date].split("-")
    time = Time.utc(year, month, day)
    day_data = GlucoseSensorData.by_day(time, :field => :timestamp)

    #@day_data.map do |datum|
    #  datum[:glucose_scaled] = (Math.log(datum[:glucose]) - Math.log(120)) ** 2
    #end

    max = GlucoseSensorData.maximum(:timestamp)
    limit = (params[:limit] || 1).to_i
    range = {}
    unless range == "all"
      range = { :begin => max - limit.months, :end => max }
    end

    averages = average_day(time, range)

    response = {
      "averages" => averages,
      "day_data" => day_data
    }

    render :json => response.to_json
  end

  def heat_map
  end

  def _get_monthly_glucose_ratios(year, global_average=0)
    monthly_ratio_list = []
    (1..12).each do |month|
      dict = {}
      if global_average != 0
        query = GlucoseSensorData.where("month = #{month}")
      else
        query = GlucoseSensorData.by_month(month, :year => year, :field => :timestamp)
      end
      total = query.count
      dict[:low] = (total != 0) ? query.where("glucose < 80").count.to_f / total : 0
      dict[:optimal] = (total != 0) ? query.where("glucose >= 80 and glucose < 180").count.to_f / total : 0
      dict[:high] = (total != 0) ? query.where("glucose >= 180").count.to_f / total : 0
      dict[:date] = Date.new(2012, month).to_s
      monthly_ratio_list << dict
    end
    return monthly_ratio_list
  end

  def get_monthly_glucose_ratios
    year, month, day = params[:date].split("-").map(&:to_i)
    global_average = params[:global_average].to_i
    data = {}
    data[:data] = _get_monthly_glucose_ratios(year)
    if global_average != 0
      data[:averages] = _get_monthly_glucose_ratios(year, global_average)
    end
    render :json => data
  end

  def _get_daily_glucose_ratios(year, month, week, n_prior_weeks=0)
    date_obj = Date.new(year, month).beginning_of_week + week.weeks
    daily_ratio_list = []
    (0..6).each do |offset|
      dict = {}
      if n_prior_weeks > 0
        query = GlucoseSensorData.between(date_obj - n_prior_weeks.weeks, date_obj - 1.day, :field => :timestamp).where("day = #{date_obj.wday}")
      else
        query = GlucoseSensorData.by_day(date_obj, :field => :timestamp)
      end
      total = query.count
      dict[:low] = (total != 0) ? query.where("glucose < 80").count.to_f / total : 0
      dict[:optimal] = (total != 0) ? query.where("glucose >= 80 and glucose < 180").count.to_f / total : 0
      dict[:high] = (total != 0) ? query.where("glucose >= 180").count.to_f / total : 0
      dict[:date] = date_obj.to_s
      daily_ratio_list << dict
      date_obj += 1.day
    end
    return daily_ratio_list
  end

  def get_daily_glucose_ratios

    year = params[:year].to_i
    month = params[:month].to_i + 1 # adjust for 0 index
    week = params[:week].to_i
    n_prior_weeks = params[:n_prior_weeks].to_i
    data = {}
    data[:data] = _get_daily_glucose_ratios(year, month, week)
    if n_prior_weeks != 0
      data[:averages] = _get_daily_glucose_ratios(year, month, week, n_prior_weeks)
    end
    render :json => data
  end
end
