/**********************************************************************
** Covid-19 forecast
** Copyright (C) 2020 Peter Diener
** and contributors
** This program is free software: you can redistribute it and/or modify
** it under the terms of the GNU General Public License as published by
** the Free Software Foundation, either version 3 of the License, or
** (at your option) any later version.
** This program is distributed in the hope that it will be useful,
** but WITHOUT ANY WARRANTY; without even the implied warranty of
** MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
** GNU General Public License for more details.
** You should have received a copy of the GNU General Public License
** along with this program. If not, see <http://www.gnu.org/licenses/>.
**********************************************************************/

var width = 1600;
var height = 800;

var restrictions = [
//  [Date(2020,1,26), 1],
  [new Date(2020,1,23), 0.8],
  [new Date(2020,2,08), 0.7],
  [new Date(2020,2,13), 0.4],
  [new Date(2020,2,21), 0.165]
]

var svg = d3.select("#visu")
  .append("svg-container", true)
  .append("svg")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("viewBox", "0 0 1900 950")
    .classed("svg-content-responsive", true)
  .append("g")
    .attr("transform",
          "translate(100,20)");

var data_diagnosed = [];
var data_dead = [];

document.getElementById('addDate').valueAsDate = new Date();

console.log(country);

d3.csv("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_global.csv", function(data) {
// Use a cashed version from server in order not to leak any information from browser to github
//d3.csv("time_series_covid19_deaths_global.csv", function(data) {
  data_dead = data;
  if (data_diagnosed.length > 0) {
    process_data(data_diagnosed, data_dead);
  }
});

d3.csv("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv", function(data) {
// Use a cashed version from server in order not to leak any information from browser to github
//d3.csv("time_series_covid19_confirmed_global.csv", function(data) {
  data_diagnosed = data;
  if (data_dead.length > 0) {
    process_data(data_diagnosed, data_dead);
  }
});

var process_data = function(data_diagnosed, data_dead) {

    var dataReady = [];

    // Extract germany from data set
    var parsed_diagnosed = {};
    var parsed_dead = {};

    data_diagnosed.forEach(function(d) {
        if (d["Country/Region"] == country) {
          parsed_diagnosed = d;
        }
    });

    data_dead.forEach(function(d) {
        if (d["Country/Region"] == country) {
          parsed_dead = d;
        }
    });


    var startDate = new Date(2020,0, 22);

    var who_diagnosed       = {color: "#40A040C0", legendOffset: "0",name: "By JHU Confirmed Diagnosed", values: []};
    var who_dead            = {color: "#000000C0", legendOffset: "0",name: "By JHU Confirmed Dead", values: []};
    var sim_infectable      = {color: "#308030C0", legendOffset: "25", name: "Forecast Infectable", values: []};
    var sim_infected        = {color: "#B0B000C0", legendOffset: "0", name: "Forecast Infected (incl. dead)", values: []};
    var sim_infectious      = {color: "#A00000C0", legendOffset: "-40", name: "Forecast Infectious", values: []};
    var sim_newInfections   = {color: "#a14b12C0", legendOffset: "-25", name: "Forecast new Infections", values: []};
    var sim_diagnosable     = {color: "#20A0C0C0", legendOffset: "20", name: "Forecast Diagnosable", values: []};
    var sim_dead            = {color: "#913d00C0", legendOffset: "0", name: "Forecast Dead", values: []};
    var sim_icu	            = {color: "#ad03fcC0", legendOffset: "-10", name: "Forecast ICU Load", values: []};

    parseDate = d3.timeParse('%m/%d/%y');
    var i = 0;
    for (var day in parsed_diagnosed) {
      i++;
      if (i > 4) {
        var string = parseDate(day);
        var val = parsed_diagnosed[day];
        if (val == 0) {
          val = 1e-3;
        }
        if (val > 0.5) {
          who_diagnosed.values.push( {
            time: parseDate(day),
            value: val
          })
        }
      }
    }

    i = 0;
    for (var day in parsed_dead) {
      i++;
      if (i > 4) {
        var string = parseDate(day);
        var val = parsed_dead[day];
        if (val > 0.5) {
          who_dead.values.push( {
            time: parseDate(day),
            value: val
          })
        }
      }
    }



    // Simulation of spread
    var P0 = 82790000; 	// Starting population
    var dates = [];
    var i=0;
    var infectionCoeficient = 0.75;	// number of people an infected person infects per day if no immunity is present around and no social restriction are active
    var deathRate = 0.004;		// proportion of infected that will die
    var icuRate = 0.01;			// proportion of infected needing intensive care unit
    var icuDelay = 9;			// days of delay a person in need of icu from infection to start of intensive care
    var icuDuration = 15;		// number of days intesive care is needed per individual person
    for (var day  of d3.timeDay.every(1).range(new Date(2020, 0, 1), new Date(2020, 12, 30))) {
      dates.push(
      {
        step: i,
        time: day,
        Infectable: P0,
        Infected: 1e-3,
        Infectious: 1e-3,
        NewInfections: 1e-3,
        Diagnosable: 1e-3,
        Dead: 1e-3,
        ICU: 0
      }
      );
      i++;
    }

    dates[0].Infectable = P0;
    dates[38].NewInfections = 5;

    var k = 0;
    var rateOfSocialInteraction = 1;

    for (var i=39; i<280; i++) {
      var date = dates[i];

      console.log(date.time);
      console.log(restrictions[k][1]);
      console.log(k);

      // einschränkung der Verbreitung
      if(date.time > restrictions[k][0]){
        rateOfSocialInteraction = restrictions[k][1];
        if(k != (restrictions.length - 1))
        k++;
      }

      // Infizierend
      for (var incTime=3; incTime<=14; incTime++) {
        date.Infectious += dates[i-incTime].NewInfections;
      }

      date.Infectious = Math.round(date.Infectious);

      // Bereits infiziert
      date.Infected = Math.round(dates[i-1].Infected + dates[i-1].NewInfections);
      // Neu infiziert
      date.NewInfections = Math.round(infectionCoeficient * rateOfSocialInteraction * date.Infectious * (dates[i-1].Infectable / P0));
      // Infizierbar
      date.Infectable = dates[i-1].Infectable - date.NewInfections;
      // Diagnostizierbar
      date.Diagnosable = dates[i-9].Infected;
      // Tot
      date.Dead = Math.round(deathRate * dates[i-13].Infected);
      // Intensivpatient
      for (var t=icuDelay; t<=(icuDelay+icuDuration); t++) {
          date.ICU += icuRate * dates[i-t].NewInfections;
      }

      date.ICU = Math.round(date.ICU);

      dates[i] = date;

      if (date.Infectable > 0.5) {
        sim_infectable.values.push( {
            time: date.time,
            value: date.Infectable
          });
      }

      if (date.Infected > 0.5) {
        sim_infected.values.push( {
            time: date.time,
            value: date.Infected
        });
      }

      if (date.Infectious > 0.5) {
        sim_infectious.values.push( {
            time: date.time,
            value: date.Infectious
        });
      }

      if (date.NewInfections > 0.5) {
        sim_newInfections.values.push( {
            time: date.time,
            value: date.NewInfections
        });
      }

      if (date.Diagnosable > 0.5) {
        sim_diagnosable.values.push( {
            time: date.time,
            value: date.Diagnosable
        });
      }

      if (date.Dead > 0.5) {
        sim_dead.values.push( {
            time: date.time,
            value: date.Dead
        });
      }

      if (date.ICU > 0.5) {
        sim_icu.values.push( {
            time: date.time,
            value: date.ICU
        });
      }

    }


    //console.log(dates);

    dataReady[0] = sim_infectable;
    dataReady[1] = sim_infected;
    dataReady[2] = sim_infectious;
    dataReady[3] = sim_newInfections;
    dataReady[4] = sim_diagnosable;
    dataReady[5] = sim_dead;
    dataReady[6] = who_diagnosed;
    dataReady[7] = who_dead;
    dataReady[8] = sim_icu;


    // List of groups (here I have one group per column)
    var allGroup = ["Infectable", "Infected", "Infectious", "Dead"];

    // Colors
    var myColor = d3.scaleOrdinal()
      .domain(dataReady)
      .range(d3.schemeSet2);

    // x axis (time)
    var x = d3.scaleTime()
      .domain([new Date(2020, 0, 1), new Date(2020, 9, 15)])
      .range([ 0, width ]);

    var axisBottom = d3.axisBottom()
      .scale(x)
      .ticks(20);

    svg.append("g")
      .attr("class", "axisX")
      .attr("transform", "translate(0," + height + ")")
      .call(axisBottom);

    // y axis (number of people)
    var y = d3.scaleLog()
      .domain( [1,1e8])
      .range([ height, 0 ]);

    var axisLeft = d3.axisLeft().scale(y).tickFormat(function (d) {
      return y.tickFormat(8, d3.format(",d"))(d)
    })


    svg.append("g")
      .attr("class", "axisY")
      .call(axisLeft);

    // Scale grid
    svg.selectAll('.axisX')
      .selectAll('line')
      .attr('y1', -height);
    svg.selectAll('.axisY')
      .selectAll('line')
      .attr('x1', width);

    var graphs = svg.append("g")
                    .attr("class", "graphs");

    // Graphs
    var line = d3.line()
      .x(function(d) { return x(+d.time) })
      .y(function(d) { return y(+d.value) });

    graphs.selectAll("myLines")
      .data(dataReady)
      .enter()
      .append("path")
        .attr("d", function(d){ return line(d.values) } )
        .attr("stroke", function(d){ return d.color })
        .style("stroke-width", 4)
        .style("fill", "none");

    // Points on graphs
    graphs
      .selectAll("myDots")
      .data(dataReady)
      .enter()
        .append('g')
        .style("fill", function(d){ return d.color })
      .selectAll("myPoints")
      .data(function(d){ return d.values })
      .enter()
      .append("circle")
        .attr("cx", function(d) { return x(d.time) } )
        .attr("cy", function(d) { return y(d.value) } )
        .attr("r", 4)
        .attr("stroke", "#40404060");

    // Graph labels
    graphs
      .selectAll("myLabels")
      .data(dataReady)
      .enter()
        .append('g')
        .append("text")
          .datum(function(d) { return {color: d.color, legendOffset: d.legendOffset, name: d.name, value: d.values[d.values.length - 1]}; }) // keep only the last value of each time series
          .attr("transform", function(d) { return "translate(" + x(d.value.time) + "," + y(d.value.value) + ")"; }) // Put the text at the position of the last point
          .attr("x", 28) // shift the text a bit more right
          .attr("y", function(d) { return d.legendOffset } )
          .text(function(d) { return d.name })
          .style("fill", function(d){ return d.color })
          .style("font-size", 15)
          .style("font-weight", "bold");



    // Add news numbers
    var dateToday = dataReady[6].values[dataReady[6].values.length - 1].time;

    var fnum = d3.format(",.0f");

    var textbox = svg
      .append('g')
      .attr('transform', 'translate(40,50)');

      var y = 25;

      textbox
        .append('rect')
        .attr('width', 200)
        .attr('height', 450)
        .attr('rx', 30)
        .attr('ry', 30)
        .style('stroke', '#404040')
        .style('fill', '#101010D0')
        .style('stroke-width', 2);

      textbox
        .append('text')
          .attr('x', 30)
          .attr('y', y)
          .style('fill', '#A00000')
          .style('font-size', '80%')
          .style('text-decoration', 'underline')
          .text('Today');
          y+=25;

      textbox
        .append('text')
          .attr('x', 30)
          .attr('y', y)
          .style('fill', dataReady[1].color)
          .style('font-size', '80%')
          .text(fnum(dataReady[1].values[dataReady[6].values.length - 23 + 9].value)  + ' Estimated Infected');
          y+=25;

      textbox
        .append('text')
          .attr('x', 30)
          .attr('y', y)
          .style('fill', dataReady[4].color)
          .style('font-size', '80%')
          .text(fnum(dataReady[4].values[dataReady[6].values.length - 23].value)  + ' Expected Diagnosable');
          y+=25;

      textbox
        .append('text')
          .attr('x', 30)
          .attr('y', y)
          .style('fill', dataReady[6].color)
          .style('font-size', '80%')
          .text(fnum(dataReady[6].values[dataReady[6].values.length - 1].value)  + ' Confirmed Diagnosed');
          y+=25;

      textbox
        .append('text')
          .attr('x', 30)
          .attr('y', y)
          .style('fill', dataReady[5].color)
          .style('font-size', '80%')
          .text(fnum(dataReady[5].values[dataReady[6].values.length - 23 - 15 ].value)  + ' Expected Dead');
          y+=25

      textbox
        .append('text')
          .attr('x', 30)
          .attr('y', y)
          .style('fill', '#909090')
          .style('font-size', '80%')
          .text(fnum(dataReady[7].values[dataReady[7].values.length - 1 ].value)  + ' Confirmed Dead');
          y+=25

      y+=5;
      textbox
        .append('text')
          .attr('x', 30)
          .attr('y', y)
          .style('fill', '#A00000')
          .style('font-size', '80%')
          .style('text-decoration', 'underline')
          .text('+ 7 days');
          y+=25;

      textbox
        .append('text')
          .attr('x', 30)
          .attr('y', y)
          .style('fill', dataReady[1].color)
          .style('font-size', '80%')
          .text(fnum(dataReady[1].values[dataReady[6].values.length - 23 + 9 + 7].value)  + ' Estimated Infected');
          y+=25

      textbox
        .append('text')
          .attr('x', 30)
          .attr('y', y)
          .style('fill', dataReady[4].color)
          .style('font-size', '80%')
          .text(fnum(dataReady[4].values[dataReady[6].values.length - 23 + 7].value)  + ' Expected Diagnosable');
          y+=25;

      textbox
        .append('text')
          .attr('x', 30)
          .attr('y', y)
          .style('fill', dataReady[5].color)
          .style('font-size', '80%')
          .text(fnum(dataReady[5].values[dataReady[6].values.length - 23 - 15 + 7].value)  + ' Expected Dead');
          y+=25



      y+=5;
      textbox
        .append('text')
          .attr('x', 30)
          .attr('y', y)
          .style('fill', '#A00000')
          .style('font-size', '80%')
          .style('text-decoration', 'underline')
          .text('+ 14 days');
          y+=25;

      textbox
        .append('text')
          .attr('x', 30)
          .attr('y', y)
          .style('fill', dataReady[1].color)
          .style('font-size', '80%')
          .text(fnum(dataReady[1].values[dataReady[6].values.length - 23 + 9 + 14].value)  + ' Estimated Infected');
          y+=25

      textbox
        .append('text')
          .attr('x', 30)
          .attr('y', y)
          .style('fill', dataReady[4].color)
          .style('font-size', '80%')
          .text(fnum(dataReady[4].values[dataReady[6].values.length - 23 + 14].value)  + ' Expected Diagnosable');
          y+=25;

      textbox
        .append('text')
          .attr('x', 30)
          .attr('y', y)
          .style('fill', dataReady[5].color)
          .style('font-size', '80%')
          .text(fnum(dataReady[5].values[dataReady[6].values.length - 23 - 15 + 14].value)  + ' Expected Dead');
          y+=25



      y+=5;
      textbox
        .append('text')
          .attr('x', 30)
          .attr('y', y)
          .style('fill', '#A00000')
          .style('font-size', '80%')
          .style('text-decoration', 'underline')
          .text('Risk to get infected per day');
          y+=25;


      var forecast_newInfectionsToday = dataReady[3].values[dataReady[6].values.length - 23 + 9 - 2].value
      var forecast_newInfections14days = dataReady[3].values[dataReady[6].values.length - 23 + 9 - 2 + 14].value
      var f = d3.format(".3f");
      var riskToday = f(forecast_newInfectionsToday / P0 * 100);
      var risk14 = f(forecast_newInfections14days / P0 * 100);



      textbox
        .append('text')
          .attr('x', 30)
          .attr('y', y)
          .style('fill', '#606060')
          .style('font-size', '80%')
          .text('Today: ' + riskToday + ' %' + ' | +14 days: ' + risk14 + ' %');
          y+=25


    var disclaimer = svg
      .append('g')
      .attr('transform', 'translate(0,825)')
        .append('text')
          .style('fill', '#606060')
          .style('font-size', '100%');

	disclaimer
          .append('tspan')
	  .attr('x', 0)
	  .attr('dy', 20)
	    .html('Disclaimer: Please notice that this data is a forecast that might be (totally) incorrect. It is based on multiple unreliable data sources. Like a weather forecast we cannot provide exact data for the future.');

	disclaimer
          .append('tspan')
	  .attr('x', 0)
	  .attr('dy', 20)
	    .html('The more a point of data is in the future, the more accuracy is lost. So DO NOT RELY ON THIS DATA! It is intended for academic research use only.');

	disclaimer
          .append('tspan')
	  .attr('x', 0)
	  .attr('dy', 20)
	    .html('The owner of this website hereby disclaims any and all representations and warranties with respect to the Website, including accuracy, fitness for use, and merchantability.');

	disclaimer
          .append('tspan')
	  .attr('x', 0)
	  .attr('dy', 20)
	    .html('Reliance on the Website for medical guidance or use of the Website in commerce is strictly prohibited. Some data is provided by Johns Hopkins University (JHU) Center for Systems Science and Engineering.');


}

var inputPercent = document.getElementById("addPercent");
var inputDate = document.getElementById("addDate");

inputPercent.addEventListener("keyup", function(event) {
  if (event.keyCode === 13) {
   event.preventDefault();
   document.getElementById("addBtn").click();
  }
});

inputDate.addEventListener("keyup", function(event) {
  if (event.keyCode === 13) {
   event.preventDefault();
   document.getElementById("addBtn").click();
  }
});

function insertRestrictionBtn() {
  restrictions.push([new Date(inputDate.value), (inputPercent.value / 100)])

  d3.select(".graphs").remove();

  process_data(data_diagnosed, data_dead);

}
