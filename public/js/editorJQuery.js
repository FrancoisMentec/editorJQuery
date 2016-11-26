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
  $.get("https://opencompare.org/api/get/" + this.pcmID, function(data) {
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

  this.name.html(this.pcm.name);
  this.license.html(this.metadata.license);
  this.source.html(this.metadata.source);

  this.initPCM();

  this.initConfigurator();
}

//Called in pcmLoaded to update the pcm
Editor.prototype.initPCM = function(){
  this.pcmDiv.empty();
  for(var f in this.features){
    var col = $("<div>").addClass("pcm-column").addClass(this.features[f].filter.type).appendTo(this.pcmDiv);
    col.append($("<div>").addClass("pcm-column-header").html(this.features[f].name));
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
    var product = this.products[p];
    product.setVisible(filter.match(product.getCell(filter.feature)))
  }
}

//********************************************************************************************************************************************************************
//Filter
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
  this.value = ""; //Will contain a regexp entered by the user in a search form, TODO

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

  //Create div
  this.show = false;
  this.div = $("<div>").addClass("feature");

  this.button = $("<div>").addClass("feature-button").click(function(){
    that.toggleShow();
  }).appendTo(this.div);
  this.arrow = $("<div>").addClass("feature-arrow").appendTo(this.button);
  this.button.append(" " + this.feature.name);

  this.contentWrap = $("<div>").addClass("feature-content-wrap").css("height", 0).appendTo(this.div);

  this.content = $("<div>").addClass("feature-content").appendTo(this.contentWrap);

  if(this.values.length==1 || (this.type=="integer" || this.type=="float") && this.min==this.max){
    this.content.append(this.values[0]);
  }else if(this.type=="integer" || this.type=="float"){
    this.slider = new Slider(this.min, this.max, this.lower, this.upper, this.step, function(slider){
      that.lower = slider.lower;
      that.upper = slider.upper;
      that.editor.filterChanged(that);
    });
    this.content.append(this.slider.div);
  }else{
    for(var c in this.checkboxs){
      this.content.append(this.checkboxs[c].div);
    }
  }
}

Filter.prototype.match = function(cell){
  return 	this.type=="integer" && parseInt(cell.content, 10)>=this.lower && parseInt(cell.content, 10)<=this.upper ||
      this.type=="float" && parseFloat(cell.content)>=this.lower && parseFloat(cell.content)<=this.upper ||
      this.type=="string" && this.checkboxs[cell.content].isChecked();
}

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

Checkbox.prototype.setChecked = function(checked){
  if(typeof checked == "undefined"){
    checked = !this.isChecked();
  }
  this.checkbox.prop('checked', checked);
  this.triggerOnChange();
}

Checkbox.prototype.isChecked = function(){
  return this.checkbox.is(":checked");
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
    that.setLower(parseFloat(that.lowerInput.val()));
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
    that.setUpper(parseFloat(that.upperInput.val()));
  }).appendTo(this.div);
}

Slider.prototype.getLowerRatio = function(){
  return (this.lower-this.min)/(this.max-this.min);
}

Slider.prototype.setLower = function(lower){
  if(!isNaN(lower)){
    lower -= lower%this.step;
    if(lower<this.min){
      lower = this.min;
    }
    if(lower>this.max){
      lower = this.max;
    }
    if(lower>this.upper){
      this.setUpper(lower);
    }
    this.lower = lower;
    this.lowerInput.val(this.lower);
    this.lowerDiv.css("left", (this.getLowerRatio()*100)+"%");
    this.triggerOnChange();
  }
}

Slider.prototype.setUpper = function(upper){
  if(!isNaN(upper)){
    upper -= upper%this.step;
    if(upper<this.min){
      upper = this.min;
    }
    if(upper<this.lower){
      this.setLower(upper);
    }
    if(upper>this.max){
      upper = this.max;
    }
    this.upper = upper;
    this.upperInput.val(this.upper);
    this.upperDiv.css("left", (this.getUpperRatio()*100)+"%");
    this.triggerOnChange();
  }
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
