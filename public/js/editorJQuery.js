//********************************************************************************************************************************************************************
//Editor
function Editor(divID, pcmID){
  var that = this;
  this.div = $("#"+divID).addClass("editor");
  this.pcmID = pcmID;
  this.loadPCM();

  this.pcm = false;
  this.metadata = false;

  //Create header
  this.header = $("<div>").addClass("editor-header").appendTo(this.div);
  this.name = $("<div>").addClass("pcm-name").html("No pcm loaded").appendTo(this.header);
  this.licenseDiv = $("<div>").addClass("pcm-param").html("<b>License : </b>").appendTo(this.header);
  this.license = $("<span>").appendTo(this.licenseDiv);
  this.sourceDiv = $("<div>").addClass("pcm-param").html("<b>Source : </b>").appendTo(this.header);
  this.source = $("<span>").appendTo(this.sourceDiv);

  //Create action bar
  this.actionBar = $("<div>").addClass("editor-action-bar").appendTo(this.div);
  this.showConfiguratorButton = $("<div>").addClass("button").click(function(){
    that.showConfigurator();
  }).appendTo(this.actionBar);
  this.configuratorArrow = $("<div>").addClass("configurator-arrow").appendTo(this.showConfiguratorButton);
  this.showConfiguratorButton.append(" ");
  this.showConfiguratorButtonMessage = $("<span>").html("Hide configurator").appendTo(this.showConfiguratorButton);

  //Create content
  this.content = $("<div>").addClass("editor-content").appendTo(this.div);

  //Create configurator
  this.configuratorShow = true;
  this.configurator = $("<div>").addClass("configurator").appendTo(this.content);

  //Create pcm wrap
  this.pcmWrap = $("<div>").addClass("pcm-wrap").appendTo(this.content);

  //Create pcmDiv
  this.pcmDiv = $("<div>").addClass("pcm").appendTo(this.pcmWrap);
}

//Load the pcm
Editor.prototype.loadPCM = function(pcmID=false){
  var that = this;
  if(pcmID){
    this.pcmID = pcmID;
  }

  //API url : https://opencompare.org/api/get/
  $.get("/pcm/" + this.pcmID + ".json", function(data) {
    that.metadata = data.metadata; //Get metadata
    that.pcm = pcmApi.loadPCMModelFromString(JSON.stringify(data.pcm)); //Load PCM
    //console.log(data);
    pcmApi.decodePCM(that.pcm); //Decode the PCM with KMF, require pcmApi

    //Extract products
    that.products = [];
    for (var i = 0; i < that.pcm.products.size(); i++) {
      var product = that.pcm.products.get(i);

      //Add a function that return the cell corresponding to the feature
      product.getCell = function(feature){
        var cell = false;
        for(var i=0;i<this.cells.size();i++){
          if(this.cells.get(i).feature.generated_KMF_ID == feature.generated_KMF_ID){
            cell = this.cells.get(i);
            break;
          }
        }
        return cell;
      }

      //Create a div for each cell
      for(var c=0;c<product.cells.size();c++){
        product.cells.get(c).div = $("<div>").addClass("pcm-cell").html(product.cells.get(c).content);
        product.cells.get(c).match = true;
      }

      //Add a function that return if all cell.match==true
      product.match = function(){
        var match = true;
        for(var c=0;c<this.cells.size();c++){
          if(this.cells.get(c).match==false){
            match = false;
            break;
          }
        }
        return match;
      }

      //Add a function that hide/show cells (used to hide products that doesn't match configurator)
      product.setVisible = function(visible){
        for(var c=0;c<this.cells.size();c++){
          if(visible){
            this.cells.get(c).div.removeClass("hidden");
          }else{
            this.cells.get(c).div.addClass("hidden");
          }
        }
      }

      that.products.push(product);
    }

    //Extract features
    that.features = [];
    for (var i = 0; i < that.pcm.features.size(); i++) {
      var feature = that.pcm.features.get(i);
      feature.filter = new Filter(feature, that.products, that); //filter is used to filter products on this feature
      if(that.pcm.productsKey.generated_KMF_ID == feature.generated_KMF_ID){
        that.features.splice(0, 0, feature);
      }else{
        that.features.push(feature);
      }
    }

    that.pcmLoaded();
  });
}

//Called when the pcm is loaded to update the UI
Editor.prototype.pcmLoaded = function(){
  console.log(this.pcm);

  //Name
  var name = this.pcm.name;
  if(name.length==0){
    name = "No name";
  }
  this.name.html(name);

  //License
  var license = this.metadata.license;
  if(license.length==0){
    license = "unknown";
  }
  this.license.html(license);

  //Source
  var source = this.metadata.source;
  if(source.length==0){
    source = "unknown";
  }
  this.source.html(source);

  //Sort products on first feature (display inside by calling Editor.initPCM())
  this.features[0].filter.setSorting(ASCENDING_SORTING);

  //Init configurator
  this.initConfigurator();
}

//Called in pcmLoaded to update the pcm
Editor.prototype.initPCM = function(){
  this.pcmDiv.find(".pcm-column-header").detach();
  this.pcmDiv.find(".pcm-cell").detach();
  this.pcmDiv.empty();
  for(var f in this.features){
    var col = $("<div>").addClass("pcm-column").addClass(this.features[f].filter.type).appendTo(this.pcmDiv);
    col.append(this.features[f].filter.columnHeader);
    for(var p in this.products){
      col.append(this.products[p].getCell(this.features[f]).div);
    }
  }
}

//Called in pcmLoaded to update the configurator
Editor.prototype.initConfigurator = function(){
  this.configurator.empty();
  for(var f in this.features){
    this.configurator.append(this.features[f].filter.div);
  }
}

//Hide or show the configurator
Editor.prototype.showConfigurator = function(){
  this.configuratorShow = !this.configuratorShow;

  if(this.configuratorShow){
    this.configurator.removeClass("hidden");
    this.pcmWrap.removeClass("full-width");
    this.configuratorArrow.removeClass("right");
    this.showConfiguratorButtonMessage.html("Hide configurator");
  }else{
    this.configurator.addClass("hidden");
    this.pcmWrap.addClass("full-width");
    this.configuratorArrow.addClass("right");
    this.showConfiguratorButtonMessage.html("Show configurator");
  }
}

//Called when a filter changed
Editor.prototype.filterChanged = function(filter){
  for(var p in this.products){
    var product = this.products[p]; // get the product
    // chech if the product match all filters (product.match() is not evaluated if filter.match(product.getCell(filter.feature))==false, it's better for perf)
    product.setVisible(filter.match(product.getCell(filter.feature)) && product.match());
  }
}

//Sort products on the feature using quicksort
Editor.prototype.sortProducts = function(feature=false){
  if(!feature){
    feature = this.features[0];
  }

  this.quicksortProducts(0, this.products.length-1, feature);

  //Update pcm
  editor.initPCM();
}

Editor.prototype.quicksortProducts = function(lo, hi, f){
  if(lo<hi){
    var p = this.partitionProducts(lo, hi, f);
    this.quicksortProducts(lo, p-1, f);
    this.quicksortProducts(p+1,hi, f);
  }
}

Editor.prototype.partitionProducts = function(lo, hi, f){
  var pivot = this.products[hi];
  var i = lo;
  for(var j=lo;j<hi;j++){
    if(f.filter.compare(this.products[j], pivot)<=0){
      var temp = this.products[i];
      this.products[i] = this.products[j];
      this.products[j] = temp;
      i++;
    }
  }
  var temp = this.products[i];
  this.products[i] = this.products[hi];
  this.products[hi] = temp;
  return i;
}

//********************************************************************************************************************************************************************
//Filter
var NO_SORTING = 1;
var ASCENDING_SORTING = 2;
var DESCENDING_SORTING = 3;

function Filter(feature, products, editor){
  var that = this;
  this.feature = feature;
  this.editor = editor;
  this.values = []; //Contains all values for this feature
  this.checkboxs = {}; //For each value associate a checkbox that say if the value match the filter
  this.min = false; //Minimum value in all values
  this.max = false; //Maximum value in all values
  this.lower = false; //Minimum value which match filter
  this.upper = false; //Maximum value which match filter
  this.step = 1; //Step for the slider when feature is a numeric value
  this.type = "undefined"; //Type of the values : Integer, Float, String
  this.search = ""; //Will contain a regexp entered by the user in a search form, TODO
  this.sorting = NO_SORTING;

  //Determine type of feature
  var integer = 0;
  var float = 0;
  var string = 0;

  for(var p in products){
    var content = products[p].getCell(feature).content;

    if($.inArray(content, this.values)==-1){
      this.values.push(content);
    }

    if(content.length>0){
      if(/^\d+$/.test(content)){
        integer++;
      }else if(/^\d+\.\d+$/.test(content)){
        float++;
      }else{
        string++;
      }
    }
  }

  if(integer>0 && float==0 && string==0){ //Integer
    this.type = "integer";

    for(var v in this.values){
      var value = parseInt(this.values[v], 10);
      if(!this.min && !this.max){
        this.min = value;
        this.max = value;
      }else if(value<this.min){
        this.min = value;
      }else if(value>this.max){
        this.max = value;
      }
    }
    this.lower = this.min;
    this.upper = this.max;
    this.step = 1;
  }else if(float>0 && string==0){ //Float
    this.type = "float";

    for(var v in this.values){
      var value = parseFloat(this.values[v]);
      if(!this.min && !this.max){
        this.min = value;
        this.max = value;
      }else if(value<this.min){
        this.min = value;
      }else if(value>this.max){
        this.max = value;
      }
    }
    this.lower = this.min;
    this.upper = this.max;
    this.step = 0.1;
  }else{ //String
    this.type = "string";

    this.values.sort();

    for(var v in this.values){
      this.checkboxs[this.values[v]] = new Checkbox(this.values[v], function(){
        that.editor.filterChanged(that);
      });
    }
  }

  //Create div for column header
  this.columnHeader = $("<div>").addClass("pcm-column-header").click(function(){
    that.swapSorting();
  }).html(this.feature.name);

  //Create div for configurator
  this.show = false;
  this.div = $("<div>").addClass("feature");

  this.button = $("<div>").addClass("feature-button").click(function(){
    that.toggleShow();
  }).appendTo(this.div);
  this.arrow = $("<div>").addClass("feature-arrow").appendTo(this.button);
  this.button.append(" " + this.feature.name);

  this.contentWrap = $("<div>").addClass("feature-content-wrap").css("height", 0).appendTo(this.div);

  this.content = $("<div>").addClass("feature-content").appendTo(this.contentWrap);

  if(this.values.length==1 || (this.type=="integer" || this.type=="float") && this.min==this.max){ //If there is only one value
    this.content.append(this.values[0]);
  }else if(this.type=="integer" || this.type=="float"){ //If type is a number
    //Create the slider
    this.slider = new Slider(this.min, this.max, this.lower, this.upper, this.step, function(slider){
      that.lower = slider.lower;
      that.upper = slider.upper;
      that.editor.filterChanged(that);
    });

    //Add the slider
    this.content.append(this.slider.div);
  }else{ //Else, type is a string with multiple values
    //Create and add the search input
    this.searchInput = $("<input>").addClass("search-input").attr("placeholder", "Search").keyup(function(){
      if(that.searchInput.val()!=that.search){
        that.search = that.searchInput.val();
        that.editor.filterChanged(that);
      }
    }).appendTo(this.content);

    this.buttonSelectUnselectAll = $("<div>").addClass("button").click(function(){
      that.selectUnselectAll();
    }).html("Select/Unselect all").appendTo(this.content);

    //Add all checkbox
    for(var c in this.checkboxs){
      this.content.append(this.checkboxs[c].div);
    }
  }
}

//Check if the cell match this filter
Filter.prototype.match = function(cell){
  var match = false;
  if(this.type=="integer"){
    match = parseInt(cell.content, 10)>=this.lower && parseInt(cell.content, 10)<=this.upper;
  }else if(this.type=="float"){
    match = parseFloat(cell.content)>=this.lower && parseFloat(cell.content)<=this.upper;
  }else if(this.type=="string"){
    if(this.search.length>0){ //If there is a search regexp we use it and not the checkboxs
      var regexp = new RegExp(this.search, 'i'); //Create a regexp with this.search that isn't case-sensitive
      match = cell.content.match(regexp)!=null;
    }else{ //Else we use checkboxs
      match = this.checkboxs[cell.content].isChecked();
    }
  }
  cell.match = match; //Set the cell.match attribute, it's used to check if all cell match them respective filter
  return cell.match;
}

//Select/Unselect all checkboxs
Filter.prototype.selectUnselectAll = function(){
  this.search = "";

  var select = true;
  for(var c in this.checkboxs){
    if(this.checkboxs[c].notChecked()){
      select = false;
      break;
    }
  }

  for(var c in this.checkboxs){
    this.checkboxs[c].setChecked(!select, false);
  }

  this.editor.filterChanged(this);
}

//Hide/Show the filter form (checkboxs, input, slider, ...)
Filter.prototype.toggleShow = function(){
  this.show = !this.show;
  if(this.show){
    this.contentWrap.css("height", this.content.outerHeight()+"px");
    this.arrow.addClass("bottom");
  }else{
    this.contentWrap.css("height", 0);
    this.arrow.removeClass("bottom");
  }
}

//Change sorting
Filter.prototype.swapSorting = function(){
  if(this.sorting==ASCENDING_SORTING){
    this.setSorting(DESCENDING_SORTING);
  }else{
    this.setSorting(ASCENDING_SORTING);
  }
}

Filter.prototype.setSorting = function(sorting, autoSort=true, resetOther=true){
  //Reset all other filter
  if(resetOther){
    for(var f in this.editor.features){
      this.editor.features[f].filter.setSorting(NO_SORTING, false, false);
    }
  }

  //remove old class
  if(this.sorting==ASCENDING_SORTING){
    this.columnHeader.removeClass("ascending");
  }else if(this.sorting==DESCENDING_SORTING){
    this.columnHeader.removeClass("descending");
  }

  //set new value
  this.sorting = sorting;

  //add new class
  if(this.sorting==ASCENDING_SORTING){
    this.columnHeader.addClass("ascending");
  }else if(this.sorting==DESCENDING_SORTING){
    this.columnHeader.addClass("descending");
  }

  //sort
  if(autoSort){
    this.editor.sortProducts(this.feature);
  }
}

//Compare
Filter.prototype.compare = function(p1, p2){
  var res = 0;
  if(this.sorting==NO_SORTING){
    console.log("Try to compare 2 product2 using a filter without sorting direction");
  }else{
    if(p1.getCell(this.feature).content>p2.getCell(this.feature).content){
      res = 1;
    }else if(p1.getCell(this.feature).content<p2.getCell(this.feature).content){
      res = -1;
    }
  }

  if(this.sorting==DESCENDING_SORTING){
    res = res * -1;
  }

  return res;
}


//********************************************************************************************************************************************************************
//Checkbox
function Checkbox(name, onChange=false, checked=true){
  var that = this;
  this.onChange = onChange;
  this.div = $("<div>").addClass("checkbox");
  this.checkbox = $("<input type='checkbox'>").prop('checked', checked).change(function(){
    that.triggerOnChange()
  }).appendTo(this.div);
  this.name = name;
  this.label = $("<label>").addClass("checkbox-label").html(this.name).click(function(){
    that.setChecked();
  }).appendTo(this.div);
}

Checkbox.prototype.setChecked = function(checked, trigger=true){
  if(typeof checked == "undefined"){
    checked = !this.isChecked();
  }
  this.checkbox.prop('checked', checked);

  if(trigger){
    this.triggerOnChange();
  }
}

Checkbox.prototype.isChecked = function(){
  return this.checkbox.is(":checked");
}

Checkbox.prototype.notChecked = function(){
  return !this.isChecked();
}

Checkbox.prototype.triggerOnChange = function(){
  if(this.onChange){
    this.onChange(this);
  }
}

//********************************************************************************************************************************************************************
//Slider
function Slider(min, max, lower, upper, step, onChange=false){
  var that = this;
  this.min = min;
  this.max = max;
  if(this.max<this.min){
    var temp = this.min;
    this.min = this.max;
    this.max = temp;
  }
  this.lower = lower;
  if(this.lower<this.min){
    this.lower = this.min
  }
  if(this.lower>this.max){
    this.lower = this.max
  }
  this.upper = upper;
  if(this.upper>this.max){
    this.upper = this.max
  }
  if(this.upper<this.lower){
    this.upper = this.lower
  }
  this.step = step;
  this.onChange = onChange;
  this.lowerHandled = false;
  this.upperHandled = false;

  $(document).mouseup(function(){
    that.lowerHandled = false;
    that.lowerDiv.removeClass("active");
    that.upperHandled = false;
    that.upperDiv.removeClass("active");
  }).mousemove(function(event){
    that.mousemove(event);
  });
  this.div = $("<div>").addClass("slider");
  this.lowerInput = $("<input>").val(this.lower).keyup(function(){
    that.setLower(parseFloat(that.lowerInput.val()), false);
  }).appendTo(this.div);
  this.range = $("<div>").addClass("slider-range").appendTo(this.div);
  this.lowerDiv = $("<div>").addClass("slider-thumb").css("left", (this.getLowerRatio()*100)+"%").mousedown(function(){
    that.lowerHandled = true;
    that.lowerDiv.addClass("active");
  }).appendTo(this.range);
  this.upperDiv = $("<div>").addClass("slider-thumb").css("left", (this.getUpperRatio()*100)+"%").mousedown(function(){
    that.upperHandled = true;
    that.upperDiv.addClass("active");
  }).appendTo(this.range);
  this.upperInput = $("<input>").val(this.upper).keyup(function(){
    that.setUpper(parseFloat(that.upperInput.val()), false);
  }).appendTo(this.div);
}

Slider.prototype.getLowerRatio = function(){
  return (this.lower-this.min)/(this.max-this.min);
}

//lower is the value to set lower, correct is if we can correct the value if out of bound (if the false value is rejected)
Slider.prototype.setLower = function(lower, correct=true){
  if(!isNaN(lower)){
    lower -= lower%this.step;
    if(lower<this.min){
      if(correct){
        lower = this.min;
      }else{
        return false;
      }
    }
    if(lower>this.max){
      if(correct){
        lower = this.max;
      }else{
        return false;
      }
    }
    if(lower>this.upper){
      if(correct){
        this.setUpper(lower, correct);
      }else{
        return false;
      }
    }
    this.lower = lower;
    this.lowerInput.val(this.lower);
    this.lowerDiv.css("left", (this.getLowerRatio()*100)+"%");
    this.triggerOnChange();
    return true;
  }
  return false;
}

//upper is the value to set upper, correct is if we can correct the value if out of bound (if the false value is rejected)
Slider.prototype.setUpper = function(upper, correct=true){
  if(!isNaN(upper)){
    upper -= upper%this.step;
    if(upper<this.min){
      if(correct){
        upper = this.min;
      }else{
        return false;
      }
    }
    if(upper<this.lower){
      if(correct){
        this.setLower(upper, correct);
      }else{
        return false;
      }
    }
    if(upper>this.max){
      if(correct){
        upper = this.max;
      }else{
        return false;
      }
    }
    this.upper = upper;
    this.upperInput.val(this.upper);
    this.upperDiv.css("left", (this.getUpperRatio()*100)+"%");
    this.triggerOnChange();
    return true;
  }
  return false;
}

Slider.prototype.getUpperRatio = function(){
  return (this.upper-this.min)/(this.max-this.min);
}

Slider.prototype.mousemove = function(event){
  if(this.lowerHandled){
    this.setLower(((event.pageX-this.range.offset().left)/this.range.width())*(this.max-this.min)+this.min);
  }else if(this.upperHandled){
    this.setUpper(((event.pageX-this.range.offset().left)/this.range.width())*(this.max-this.min)+this.min);
  }
}

Slider.prototype.triggerOnChange = function(){
  if(this.onChange){
    this.onChange(this);
  }
}
