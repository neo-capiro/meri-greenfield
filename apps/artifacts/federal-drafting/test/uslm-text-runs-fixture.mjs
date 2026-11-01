export const XML='\ufeff<?xml version="1.0" encoding="UTF-8"?>\r\n'+
 '<bill xmlns="http://schemas.gpo.gov/xml/uslm" xmlns:h="http://www.w3.org/1999/xhtml" id="bill">\r\n'+
 '<section identifier="/us/bill/1/s1" id="ignored"><content>A &amp; B &#x1F600;\r\nC\rD'+
 '<ref href="/other">reference</ref> tail<!--comment--><?note instruction?>'+
 '<![CDATA[<literal>&\r\n😀]]> end</content><h:b> foreign </h:b></section>'+ 
 '<section id="second">\t&#13;&lt;&gt;&quot;&apos;&#65;\n</section></bill>\r\n';
