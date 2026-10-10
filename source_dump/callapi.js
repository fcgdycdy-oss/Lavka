var baseurl = "../js/schedule/callapi.php";
export function getfaculties(name = false)
{
var text = "url=faculty/";
if (name) text = text + name;

return $.ajax({
	url: baseurl,
	data: text,
        context: document.body
	});
}

export function getgroups(facultyid, course = false, spec = false)
{
return $.ajax({
	url: baseurl,
	data: "url=group/"+facultyid,
        context: document.body
        });
}

export function getteacher(facultyid, name = false)
{
var text = "url=teacher/"+facultyid;
if (name) text = text + "&data=name:"+name;
return $.ajax({
	url: baseurl,
	data: text,
        context: document.body
        });
}
export function getitems(facultyid, isteacher=false)
{
    var text;
    if(isteacher) 
	return getteacher(facultyid);
    else 
	return getgroups(facultyid);

}

export function getschedule(facultyid, groupid = false, teacherid = false, roomid = false)
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