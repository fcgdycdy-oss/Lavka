	// Код факультета
	//Геологический факультет	000000010
	//Исторический факультет	000000013
	//Математический факультет	000000017
	//Медико-биологический факультет	000000007
	//Факультет географии, геоэкологии и туризма	000000016
	//Факультет журналистики	000000003
	//Факультет компьютерных наук	000000012
	//Факультет международных отношений	000000018
	//Факультет прикладной математики, информатики и механики	000000005
	//Факультет романо-германской филологии	000000006
	//Факультет философии и психологии	000000014
	//Фармацевтический факультет	000000002
	//Физический факультет	000000015
        //Филологический факультет	000000004
	//Химический факультет	000000011
	//Экономический факультет	000000008
	//Юридический факультет	000000009

	var baseurl = "js/schedule/callapi.php";

	function getfaculties(name)
	{
	return $.ajax({
	    url: baseurl,
	    data: "url=faculty/"+name,
            context: document.body
	});
	}

	function getgroups(facultyid, course, spec)
	{
	return $.ajax({
	    url: baseurl,
    	    data: "url=group/"+facultyid,
	    context: document.body
        });
	}
	function getteacher(facultyid, name)
	{
	var text = "url=teacher/"+facultyid;
	if (name) text = text + "&data=name:"+name;
	return $.ajax({
	    url: baseurl,
    	    data: text,
	    context: document.body
        });
	}
	function getitems(facultyid, isteacher)
	{
	var text;
	if(isteacher)
	    return getteacher(facultyid);
	else
	    return getgroups(facultyid);
	}

	function getschedule(facultyid, groupid, teacherid, roomid)
	{
	var text = "url=schedule/"+facultyid;
	if (groupid || teacherid || roomid) text = text + "&data=";
	if (groupid) text = text + "groupID:"+groupid+" ";
	if (teacherid) text = text + "teacherID:"+teacherid+" ";
	if (roomid) text = text + "roomID:"+roomid+" ";
	text = text.trim();
	return $.ajax({
	    url: baseurl,
	    data: text,
	    context: document.body
        });
	}
	function addEvtHandler() {
	    var selElem = document.getElementById("nested");
	    selElem.onchange = function () {
		loadlevel();
	    }
	}

    	var fid = '000000008'; // Прописать код факультета или вызвать функцию getfaculties(полное название факультета), которая вернет код)
	// массив описания уровней dropbox выбора группы
	var items;
	// Массив для описания уроовней каскадного dropbox 1-уровень (1 поле-значение массива в список: 2 поле - значение в атрибут data-id списка)
	var tiers;
	var isteacher; 
	var filters = [];
	var levels;
	var currlevel;
	// DOM elements for use with script
	var basediv = $(document).find('#nested');
        var placeholder = ['Начать выбор...'];
	var choicebtn = $('<button class="btn btn-outline-info" id=nestedchoice>Расписание по группе</button>').attr('style','width:100%;margin:5px 0 5px 0;').on('click', function(){
	    choicebtn.prop('disabled',true);
	    $('#load').remove();
	    basediv.append($('<div id=load class=loader>').append($('<div class=bar>')));
	    isteacher=!isteacher;
	    this.innerText = isteacher ? 'Расписание по преподавателю' : 'Расписание по группе';
	    placeholder = ['Начать выбор...'];
   	    currlevel = 1;
	    filters = [];
	    show.css('display','none');
	    closebtn.css('display','none');
	    schedulearea.empty();
	    getdata();
	});    

	var input = $('<select class="form-control" id=nestedinput>').attr('style','max-width:100%;');
	// кнопка сброса dropdown
	var closebtn = $('<span id=closebtn>Очистить</span>').attr('style',' display: none; margin: 0 5px 0 5px; cursor:pointer; float:right').on('click', function(){
		currlevel = 1;
		filters = [];
		placeholder = ['Начать выбор...'];
		show.css('display','none');
		closebtn.css('display','none');
		schedulearea.empty();
		fillDatalist(input, items.map(function(val){ 
			var values = Object.keys(tiers[currlevel]).map(function(e) {
			    return (tiers[currlevel])[e]
			});
			 return new Object([val[values[0]],val[Object.keys(tiers[currlevel])[0]]]);
		}),placeholder);
		placeholder=[];
	});    
	var popup = $('<div id=popup-schedule>').addClass('white-popup mfp-hide').append($('<h3 id=grouptitle>').text('Расписание занятий'));
	var schedulearea = $('<div id=schedule>');
	popup.append(schedulearea);
	var show = $('<a id=show href=#popup-schedule>').attr('style','display: none; margin: 0 5px 0 5px; cursor:pointer; text-decoration:none; float:right').addClass('schedule-popup').html(' Показать ');
////////////////////////////////////////////////
	// Числитель-знаменатель
	 function getMonday(d) {
	  d = new Date(d);
	  var day = d.getDay(),
	  diff = d.getDate() - day + (day == 0 ? -6:1); // adjust when day is sunday
	  return new Date(d.setDate(diff));
	  }
	  var Numerator = function () {
          var year1Sep;
	  var currentDate = new Date();
	  var currentYear = currentDate.getFullYear();
	  var currentMonth = currentDate.getMonth();
	   if(currentMonth>=8 && currentMonth<=11) year1Sep = currentYear;
	   if(currentMonth>=0 && currentMonth<=7) year1Sep = currentYear-1;
	   var monday1Week = getMonday(new Date(year1Sep,8,1,0,0,0));      
	   var mondayTWeek = getMonday(currentDate.setHours(0,0,0,0));
	   var diffDate = ((mondayTWeek - monday1Week)/(1000 * 3600 * 24)/7)%2;
	   return diffDate*7;
         }
	////////////////////////////////////////////////
	// Заполнение списка опций
	
	function fillDatalist(element, optArr, title)
	{	
	    element.empty();
	    placeholder.forEach(function(val){
	    element.append('<option disabled="disabled" selected="selected">'+val+'</option>');
	    });
	    element.append('<optgroup label="'+Object.keys(tiers[currlevel])[0]+'">');
	    optArr=optArr.map(JSON.stringify).reverse().filter(function (e, i, a) {
		    return a.indexOf(e, i+1) === -1;
		    }).reverse().map(JSON.parse)
	    optArr.forEach(function(val){
		element.append($('<option />').text(val[1]).val(val[0]));		
	    });
	    element.append('</optgroup>');
	}
	//// Реализация каскадного dropdown для последовательного выбора
	function loadlevel() {
		closebtn.css('display','inline');
		if(currlevel<levels) {
		var values = Object.keys(tiers[currlevel]).map(function(e) {
		    return (tiers[currlevel])[e]
		});		
		filters.push([values[0],input.val()]);
		placeholder.push(values[0]+":"+input.val());
		input.val('');
		currlevel = currlevel+1;		
		placeholder.push('Выберите: ' + Object.keys(tiers[currlevel])[0]);
		var filteredArr = items;
		filters.forEach(function(key){
		    filteredArr = filteredArr.filter(function(res){    
			return (res[key[0]] == key[1]);
		    });
		});
		fillDatalist(input, filteredArr.map(function(val){ 
			var values = Object.keys(tiers[currlevel]).map(function(e) {
			    return (tiers[currlevel])[e]
			});
			 return new Object([val[values[0]],val[Object.keys(tiers[currlevel])[0]]]);
			}),placeholder);
		}
		if (currlevel==levels && input.val()) {
			if(isteacher==false)			    
	    			tableschedule(input.val(), false, input[0][input[0].selectedIndex].label);
			    else
				tableschedule(false, input.val(), input[0][input[0].selectedIndex].label);
			show.css('display','inline');
			}
		placeholder.pop();
    	    }
        $.when($.ready).then(function() {
	    basediv.append(choicebtn).append(input).append(closebtn).append(show);
	    basediv.append($('<div id=load class=loader>').append($('<div class=bar>')));
	    isteacher = false;
	    // Подключение вспомогательных стилей и скриптов
	    $('head').append('<link rel="stylesheet" href="js/schedule/schedule.css" type="text/css" />');
	    $('head').append('<link rel="stylesheet" href="js/schedule/magnific-popup.css" type="text/css" />');
    	    $('head').append('<script type="text/javascript" src="js/schedule/jquery.magnific-popup.min.js"></script>');
	    $('body').append(popup);
	    $('body').append('<script type="text/javascript" >$(function(){$(".schedule-popup").magnificPopup({type:"inline",preloader:false});});</script>');
	    getdata();
	    });
	/// Старт получения данных по группам, задействованным в расписании 
	    function getdata()
	    {
	    $.when(getitems(fid,isteacher)).then(function(data){    				
		choicebtn.prop('disabled',false);
		$('#load').remove();
		if(isteacher) {
			tiers = {"1":{"Наименование":"Код"}};
			levels = 1;
			}
		    else {
			tiers = {"1":{"Специальность":"Специальность"},"2":{"Курс":"Курс"},"3":{"Группа":"Код"}};
			levels = 3;
		    }
		addEvtHandler();
		items = $.parseJSON(data);
		currlevel = 1;
		fillDatalist(input, items.map(function(val){ 
			var values = Object.keys(tiers[currlevel]).map(function(e) {
			    return (tiers[currlevel])[e]
			});
			return new Object([val[values[0]],val[Object.keys(tiers[currlevel])[0]]]);
		    }));
		});
	    }

///////////////////////////////////////////////////////
// Функция получения и формирования таблицы  расписания в режиме числитель/знаменатель по выбранным параметрам

	function tableschedule(groupid, teacherid, name)
	{
	    if(schedulearea.is(':empty')) schedulearea.addClass('loader');
	     var styles = {
		borderStyle:"solid",
		borderWidth:"1px 1px 0 0",
		borderColor:"black",
	//	background: "#FEFEFE"
	    };
	   var title = $(document).find('#popup-schedule #grouptitle');
	   var table = $('<table>').addClass('time');   
	   var days = {"1":"Понедельник", "2":"Вторник", "3":"Среда", "4":"Четверг", "5":"Пятница", "6":"Суббота"};
	   var timing = {"1":"08:00-09:35", "2":"09:45-11:20", "3":"11:30-13:05", "4":"13:25-15:00","5":"15:10-16:45","6":"16:55-18:30","7":"18:40-20:00","8":"20:10-21:30"};
	   var worktype = {"Практические":"(пр)", "Лекции":"(лек)", "Лабораторные":"(лаб)"};
//	   var daycolor = {"1":"50hsl(61,50,50)",}
	   var title = $(document).find('#popup-schedule #grouptitle');
		
	   schedulearea.empty();

	   $.when(getschedule(fid, groupid,teacherid).done(function(data) {
		schedulearea.removeClass('loader');
		var schedule = $.parseJSON(data);
		var job = [];
                var today = new Date();
		var now = today.getHours()*60+today.getMinutes();
		var curts = 0;

	        if(name) {
		if(groupid) title.text("Расписание группы "+name);
		if(teacherid) title.text("Расписание преподавателя "+name);
		}
		switch(true)
		{
		    case now>=480 && now<=575: curts = 1; break;
		    case now>=585 && now<=680: curts = 2; break;
		    case now>=690 && now<=785: curts = 3; break;		    
		    case now>=805 && now<=900: curts = 4; break;		
		    case now>=910 && now<=1005: curts = 5; break;
		    case now>=1015 && now<=1110: curts = 6; break;				    
		    case now>=1120 && now<=1200: curts = 7; break;		
		    case now>=1210 && now<=1290: curts = 8; break;		
		}

//		var f = function (iday, odd, itime, current) {
//		    var o = schedule.filter(function(val){ return val['НомерДня']==(eval(iday)+odd) && val['ВременноеОкно']==timing[itime]; });
//		    var rightnow = '';
//		    if(iday==today.getDay() && itime==current && odd==Numerator()) rightnow = '<sup style="font-weight:bold; color:red;">Идёт сейчас</sup>'
//		    if (o.length === 0) return String.fromCharCode(4448)+rightnow; else return o[0]['СписокГрупп']['Группа1']+" "+o[0]['Дисциплина']+" "+worktype[o[0]['ВидНагрузки']]+" "+o[0]['Помещение']+" "+"<a target=_blank  href='https://www.vsu.ru/ru/persons/?search_person="+encodeURIComponent(o[0]['ПреподавательФИО'])+"'>"+o[0]['Преподаватель']+"</a>"+rightnow;
//		}
		var f = function (iday, odd, itime, current) {
		    var o = schedule.filter(function(val){ return val['НомерДня']==(eval(iday)+odd) && val['ВременноеОкно']==timing[itime]; });
		    var rettxt;
		    var item;
		    var rightnow = '';
		    if(iday==today.getDay() && itime==current && odd==Numerator()) 
			    rightnow = '<sup style="font-weight:bold; color:red;">Идёт сейчас</sup>'
		    if (o.length === 0)
		      return String.fromCharCode(4448)+rightnow; 
			else 
			{
                        rettxt = "";
			for (item in o)
    		    	    rettxt = rettxt + o[item]['СписокГрупп']['Группа1']+" "+o[item]['Дисциплина']+" "+worktype[o[item]['ВидНагрузки']]+" "+o[item]['Помещение']+" "+"<a target=_blank  href='https://www.vsu.ru/ru/persons/?search_person="+encodeURIComponent(o[item]['ПреподавательФИО'])+"'>"+o[item]['Преподаватель']+"</a>";
			rettxt = rettxt.replace(/a>([^.])/g,"a>│$1");
			rettxt = rettxt + rightnow;
			return rettxt;
			}
		}
		for (var i in days)
		{
		  var day = $('<td>').addClass(String(i%2)).addClass('textrotate').text(days[i]);
		  var row = $('<tr>');
		  row.append(day);
 		  var lines = 0;
		  for (var j in timing)
		   {
		    var timeslot = $('<td class="time">').addClass(String(j%2?'even':'odd')).text(timing[j]);
		    if(f(i, 0, j) != f(i, 7, j))  
			{ 
			   row.append(timeslot).append($('<td class="top">').append(f(i, 0, j, curts)));
			   table.append(row);		     
			   timeslot.attr('rowspan','2');
			   if(i==today.getDay() && j==curts && Numerator()==7) 
				table.append($('<tr>').append($('<td class="bottom">').css('background-color','#b8c6db').append(f(i, 7, j, curts))));
			    else
				table.append($('<tr>').append($('<td class="bottom">').append(f(i, 7, j, curts))));
			   if(i==today.getDay() && j==curts && Numerator()==0) row.children('.top').css('background-color','#b8c6db');
			   lines = lines + 2;
			} else {
			   row.append(timeslot).append($('<td class="top">').append(f(i, Numerator(), j, curts)));
			   table.append(row);		     			      
			   if(i==today.getDay() && j==curts) row.children('.top').css('background-color','#b8c6db');
			   lines = lines + 1;
			}
		    var newrow = $('<tr>');
		    row = newrow;
		   } 
		    day.attr('rowspan', lines);
	    	}
		table.find('td').each (function() {
		    $(this).css(styles);
		}); 
		table.find('td.even').each (function() {
		    $(this).css('background','#cccccc');
		    $(this).css('borderWidth','1px 1px 0px 0px');
		}); 
 	        schedulearea.append(table);
    	        }));
              }
    