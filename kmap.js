// alert("load kmap.js");
//webgis的核心js对象
//常量
////////////////////////////////////////////////////////////////////////////////
// constants
// PI
var X_LIGHT_SPEED = 299792458.0;
var X_PI = 3.14159265358979323846264;
var X_HALF_PI = 1.57079632679489660000000;
var X_TWO_PI = 6.28318530717958647692528;
var X_RAD2DEG = 57.2957795130823208767982165177;
var X_DEG2RAD = 0.01745329251994329576923688888;
var X_SEC_PER_DAY = 86400.0;

// WGS84 Ellipsoid Earth
var X_EARTH_R1 = 6378137.0000;
var X_EARTH_R2 = 6356752.3142;
var X_EARTH_ECCEN = 0.081819190928906327;		// sqrt(EARTH_R1^2 - EARTH_R2^2) / EARTH_R1
var X_EARTH_ECCEN2 = 0.0066943800042608276;	    // EARTH_ECCEN^2
var X_EARTH_FLATTENING = 0.0033528106718309896;	// (EARTH_R1 - EARTH_R2) / EARTH_R1

// Map Factor to ECR
var X_MAP_R1_FACTOR = X_TWO_PI * X_EARTH_R1 / 360.0;
var X_MAP_R2_FACTOR = X_TWO_PI * X_EARTH_R2 / 360.0;

var X_MAP_L0_TILE_SIZE = 18.0;
var X_MAP_L0_TILE_WIDTH = 256.0;
var X_MAP_L0_PIXEL_SIZE = X_MAP_L0_TILE_SIZE / X_MAP_L0_TILE_WIDTH;
//工具方法
////////////////////////////////////////////////////////////////////////////////
// Global functions
function GetEA() { return X_EARTH_R1; }
function GetEB() { return X_EARTH_R2; }

function XSleep(d) { for (var t = Date.now() ; Date.now() - t <= d;); }

// Coordnate Conversion
// Map coordnate -> WGS84 degree coordnate
function MapToGeo(x, y) {
    return new XVertex2(x / X_MAP_R1_FACTOR, y / X_MAP_R2_FACTOR);
}

function MapToGeo(v) {
    return new XVertex2(v.x / X_MAP_R1_FACTOR, v.y / X_MAP_R2_FACTOR);
}

// WGS84 degree coordnate -> Map coordnate
function GeoToMap(lon, lat) {
    return new XVertex2(lon * X_MAP_R1_FACTOR, lat * X_MAP_R2_FACTOR);
}

function GeoToMap(v) {
    return new XVertex2(v.x * X_MAP_R1_FACTOR, v.y * X_MAP_R2_FACTOR);
}

// Calc Tile Size ( WGS84 Degrees ) in XPBI Standard
function GetTileSize(l0TileSize, level) {
    var tileSize = l0TileSize;
    for (var i = 0; i < level; i++)
        tileSize /= 2.0;
    return tileSize;
}

// Conversion of level, row, col , lat, lon...
function GetAppropriateLevel(l0PixelSize, pixelsize) {
    if (pixelsize <= 0) return 0;

    var level = 0;
    while (pixelsize < l0PixelSize) {
        l0PixelSize /= 2.0;
        level++;
    }
    level--;
    if (level < 0) level = 0;
    return level;
}

function GetRowFromLatitude(latitude, level) {
    return parseInt((latitude - 0.000000001 + 90.0) / GetTileSize(X_MAP_L0_TILE_SIZE, level), 10);
}

function GetColFromLongitude(longitude, level) {
    return parseInt((longitude - 0.000000001 + 180.0) / GetTileSize(X_MAP_L0_TILE_SIZE, level), 10);
}
////////////////////////////////////////////////////////////////////////////////
// Rectangle
function XRect(x, y, width, height) {
    this.min = new XVertex2(x, y);
    this.max = new XVertex2(x + width, y + height);
    this.Size = new XVertex2(width, height);
}


////////////////////////////////////////////////////////////////////////////////
// Geometries postion
function XGeoPoint(lon, lat, hgt) {
    this.Lon = lon;                 // double: Longitude (WGS84 Degree)
    this.Lat = lat;                 // double: Latitude (WGS84 Degree)
    this.Hgt = hgt;                 // double: Height (Meter)
    this.Map = GeoToMap(lon, lat);  // XVertex2

    // set by lon,lat,height (degrees)
    this.llhd = function (lon, lat, ght) {
        this.Lon = lon;
        this.Lat = lat;
        this.Hgt = hgt;
        this.Map = GeoToMap(lon, lat);
    }
}

//map  显示图层 控制交互
////////////////////////////////////////////////////////////////////////////////
// XMap
var XMap =
{
    CreateNew: function (id, projection, container) {
        var View = document.createElement("div");

        View.id = id;
        View.style.cssText = 
        " background: url(mapbg_pattern.png) repeat; " +
        " position:relative; " +
        " overflow: visible;" +
        " margin: 0px; " +
        " top:0px; " + 
        " left:0px; " +
        " width:100%; " +
        " height:100%;" +
        " -webkit-user-select: none;";

        View.unselectable = "on";
        View.Projection = projection;
        View.Container = container;
        container.appendChild(View);
        View.WndSize = new XVertex2(10, 10);
        View.bMouseDown = false;
        View.bDraging = false;
        View.DragingStartPos = new XVertex2(0, 0);
        View.TouchRectSize = new XVertex2(0, 0);
        View.MsTouchs = {};
        View.MsTouchsNum = 0;

        View.NeedUpdate = true;

        // Canvas
        View.GeoCanvas = new XGeoCanvas("XMap::XGeoCanvas" + id);
        View.GeoCanvas.SetContainer(View);

        // Layers
        View.Layers = new Array();

        // APIs
        View.SetPixelSize = function (psx, psy) {
            View.GeoCanvas.SetPixelSize(psx, psy);
            for (var i = 0; i < View.Layers.length; i++)
                View.Layers[i].SetPixelSize(psx, psy);
        }

        View.GetPixelSize = function () {
            return View.GeoCanvas.PixelSize;    // return xvertex2
        }

        View.SetWorldToCenter = function (lond, latd) {
            View.GeoCanvas.SetWorldToCenter(lond, latd);
            for (var i = 0; i < View.Layers.length; i++)
                View.Layers[i].SetWorldToCenter(lond, latd);
        }

        View.SetScreenToWorld = function (scrX, scrY, lond, latd) {
            View.GeoCanvas.SetScreenToWorld(scrX, scrY, lond, latd);
            for (var i = 0; i < View.Layers.length; i++)
                View.Layers[i].SetScreenToWorld(scrX, scrY, lond, latd);
        }

        View.WorldToScreen = function (lond, latd) {
            return View.GeoCanvas.WorldToScreen(lond,latd);
        }

        View.ScreenToWorld = function (scrX, scrY) {
            return View.GeoCanvas.ScreenToWorld(scrX,scrY);
        }

        View.Invalidate = function () {
            for (var i = 0; i < View.Layers.length; i++)
                View.Layers[i].Invalidate();
            View.NeedUpdate = true;
        }

        View.AttachLayer = function (layer) {
            for (var i = 0; i < View.Layers.length; i++) {
                if (View.Layers[i].UUID == layer.UUID)
                    return false;
            }
            View.Layers.push(layer);
            View.Invalidate();
            return true;
        }

        View.DetachLayer = function (uuid) {
            for (var i = 0; i < View.Layers.length; i++) {
                if (View.Layers[i].UUID == uuid) {
                    View.Layers.splice(i, 1);
                    View.Invalidate();
                    return true;
                }
            }
            return false;
        }

        // Render
        View.OnDraw = function () {
            View.NeedUpdate = false;
            if (View.Container.clientWidth != View.WndSize.x || View.Container.clientHeight != View.WndSize.y)
                View.OnSize(View.Container.clientWidth, View.Container.clientHeight);

            View.GeoCanvas.Clear("Gray");
            for (var i = 0; i < View.Layers.length; i++)
                View.Layers[i].OnDraw();
        };

        // Thread for render daemon
        View.Process = function () {
            if (View.NeedUpdate) {
                View.OnDraw();
                setTimeout(View.Process, 1);
            }
            else {
                setTimeout(View.Process, 10);
            }
        }

        ///////////////////////////////////////////////////////////////////////////////
        // UI Message
        View.OnSize = function (cx, cy) {
            View.WndSize.xy(cx, cy);
            View.clientWidth = cx + "px";
            View.clientHeight = cy + "px";

            View.GeoCanvas.SetScreenSize(cx, cy);
            for (var i = 0; i < View.Layers.length; i++)
                View.Layers[i].OnSize(cx, cy);
        };

        // W3C mouse event model
        View.OnMouseDown = function (event) {
            if (View.MsTouchsNum > 1) {
                View.bMouseDown = true;
                return;
            }

            View.bMouseDown = true;

            if (event.button == 0) {
                View.bDraging = true;
                View.DragingStartPos = View.GeoCanvas.ScreenToWorld(event.offsetX, event.offsetY);
            }
            for (var i = 0; i < View.Layers.length; i++)
                View.Layers[i].OnMouseDown(event);
        };

        View.OnMouseMove = function (event) {
            if (View.MsTouchsNum > 1) return;

            if (!View.bMouseDown) return;
            if (event.buttons == 0) {
                View.bMouseDown = false;
                return;
            }

            if (View.bDraging) {
                View.SetScreenToWorld(event.offsetX, event.offsetY, View.DragingStartPos.x, View.DragingStartPos.y);
            }

            for (var i = 0; i < View.Layers.length; i++)
                View.Layers[i].OnMouseMove(event);

            View.Invalidate();
        };

        View.OnMouseUp = function (event) {
            if (!View.bMouseDown) return;
            if (View.MsTouchsNum > 1) return;
            View.bMouseDown = false;

            if (View.bDraging) {
                View.bDraging = false;
                View.SetScreenToWorld(event.offsetX, event.offsetY, View.DragingStartPos.x, View.DragingStartPos.y);
            }

            for (var i = 0; i < View.Layers.length; i++)
                View.Layers[i].OnMouseUp(event);
            window.document.focus();
        };

        View.OnMouseWheel = function (event) {

            if (View.MsTouchsNum > 1) return;

            var tarPszFac = 1.0;
            var offFac = 0.008;
            if (event.wheelDelta)
                tarPszFac = event.wheelDelta < 0 ? (1.0 - offFac) : (1.0 + offFac);
            else if (event.detail)
                tarPszFac = event.detail > 0 ? (1.0 - offFac) : (1.0 + offFac);

            var focusPos = View.GeoCanvas.ScreenToWorld(event.offsetX, event.offsetY);
            var mousePos = new XVertex2(event.offsetX, event.offsetY);
            //实现渐变效果的缩放
            for (var i = 0; i < 20; i++) {
                setTimeout(function () {
                    View.GeoCanvas.SetPixelSize(View.GeoCanvas.PixelSize.x * tarPszFac, View.GeoCanvas.PixelSize.y * tarPszFac);
                    View.SetScreenToWorld(mousePos.x, mousePos.y, focusPos.x, focusPos.y);
                    View.Invalidate();
                }, 10 * i);
            }

            for (var i = 0; i < View.Layers.length; i++)
                View.Layers[i].OnMouseWheel(event);

            View.Invalidate();
        }

        // Apple¡¯s iOS touch event model
        View.OnTouchStart = function (event) {
            View.bMouseDown = true;

            if (event.targetTouches.length == 1) {
                event.preventDefault();
                var touch = event.targetTouches[0];

                View.bDraging = true;
                View.DragingStartPos = View.GeoCanvas.ScreenToWorld(touch.pageX, touch.pageY);

                for (var i = 0; i < View.Layers.length; i++)
                    View.Layers[i].OnTouchStart(event);
            }
            else if (event.targetTouches.length == 2) {
                event.preventDefault();
                var touch0 = event.targetTouches[0];
                var touch1 = event.targetTouches[1];
                View.TouchRectSize.xy(Math.abs(touch0.pageX - touch1.pageX), Math.abs(touch0.pageY - touch1.pageY));
            }
        };

        View.OnTouchMove = function (event) {
            if (event.targetTouches.length == 0) {
                View.bMouseDown = false;
                return;
            }

            if (event.targetTouches.length == 1) {
                event.preventDefault();
                var touch = event.targetTouches[0];

                if (!View.bMouseDown) return;

                if (View.bDraging) {
                    View.SetScreenToWorld(touch.pageX, touch.pageY, View.DragingStartPos.x, View.DragingStartPos.y);
                }

                for (var i = 0; i < View.Layers.length; i++)
                    View.Layers[i].OnTouchMove(event);

                View.Invalidate();
            }
            else if (event.targetTouches.length == 2) {
                event.preventDefault();
                var touch0 = event.targetTouches[0];
                var touch1 = event.targetTouches[1];

                var geoPos0 = View.GeoCanvas.ScreenToWorld(touch0.pageX, touch0.pageY);
                var geoPos1 = View.GeoCanvas.ScreenToWorld(touch1.pageX, touch1.pageY);
                var geoRect = new XVertex2(Math.abs(geoPos0.x - geoPos1.x), Math.abs(geoPos0.y - geoPos1.y));

                var tarPsz = new XVertex2(geoRect.x / View.TouchRectSize.x, geoRect.y / View.TouchRectSize.y);
                tarPsz.Subtract(View.GeoCanvas.PixelSize);
                tarPsz.Inverse();
                tarPsz.Add(View.GeoCanvas.PixelSize);

                var centerScrPos = new XVertex2(touch0.pageX + (touch1.pageX - touch0.pageX) / 2.0, touch0.pageY + (touch1.pageY - touch0.pageY) / 2.0);
                var centerGeoPos = View.GeoCanvas.ScreenToWorld(centerScrPos.x, centerScrPos.y);

                var maxPsz = tarPsz.x;
                if (geoRect.x < geoRect.y) maxPsz = tarPsz.y;

                View.GeoCanvas.SetPixelSize(maxPsz, maxPsz);
                View.SetScreenToWorld(centerScrPos.x, centerScrPos.y, centerGeoPos.x, centerGeoPos.y);

                for (var i = 0; i < View.Layers.length; i++)
                    View.Layers[i].OnMouseWheel(event);

                View.Invalidate();

                View.TouchRectSize.xy(Math.abs(touch0.pageX - touch1.pageX), Math.abs(touch0.pageY - touch1.pageY));
            }
        }

        View.OnTouchEnd = function (event) {
            if (!View.bMouseDown) return;
            View.bMouseDown = false;

            event.preventDefault();
            if (View.bDraging) View.bDraging = false;

            for (var i = 0; i < View.Layers.length; i++)
                View.Layers[i].OnTouchEnd(event);
        };

        // Microsoft IE10 pointer event model    
        View.OnPointerDown = function (event) {

            if (event.pointerType == "mouse")
                return;

            View.MsTouchs[event.pointerId] = { x: event.pageX, y: event.pageY };
            View.MsTouchsNum++;

            if (View.MsTouchsNum == 2) {
                var touch0, touch1;
                for (var key in View.MsTouchs) {
                    if (!touch0) touch0 = View.MsTouchs[key];
                    else touch1 = View.MsTouchs[key];
                }
                if (!touch0 || !touch1) return;
                View.TouchRectSize.xy(Math.abs(touch0.x - touch1.x), Math.abs(touch0.y - touch1.y));
            }
        }

        View.OnPointerMove = function (event) {

            if (event.pointerType == "mouse")
                return;

            if (View.MsTouchsNum != 2) return;

            var touch0, touch1;
            for (var key in View.MsTouchs) {
                if (!touch0) touch0 = View.MsTouchs[key];
                else touch1 = View.MsTouchs[key];
            }
            if (!touch0 || !touch1) return;

            var geoPos0 = View.GeoCanvas.ScreenToWorld(touch0.x, touch0.y);
            var geoPos1 = View.GeoCanvas.ScreenToWorld(touch1.x, touch1.y);
            var geoRect = new XVertex2(Math.abs(geoPos0.x - geoPos1.x), Math.abs(geoPos0.y - geoPos1.y));

            var tarPsz = new XVertex2(geoRect.x / View.TouchRectSize.x, geoRect.y / View.TouchRectSize.y);
            tarPsz.Subtract(View.GeoCanvas.PixelSize);
            tarPsz.Inverse();
            tarPsz.Add(View.GeoCanvas.PixelSize);

            var centerScrPos = new XVertex2(touch0.x + (touch1.x - touch0.x) / 2.0, touch0.y + (touch1.y - touch0.y) / 2.0);
            var centerGeoPos = View.GeoCanvas.ScreenToWorld(centerScrPos.x, centerScrPos.y);

            var maxPsz = tarPsz.x;
            if (geoRect.x < geoRect.y) maxPsz = tarPsz.y;

            View.GeoCanvas.SetPixelSize(maxPsz, maxPsz);
            View.SetScreenToWorld(centerScrPos.x, centerScrPos.y, centerGeoPos.x, centerGeoPos.y);

            for (var i = 0; i < View.Layers.length; i++)
                View.Layers[i].OnMouseWheel(event);

            View.Invalidate();

            View.MsTouchs[event.pointerId] = { x: event.pageX, y: event.pageY };
            View.TouchRectSize.xy(Math.abs(touch0.x - touch1.x), Math.abs(touch0.y - touch1.y));
            //console.log(View.TouchRectSize.x + "," + View.TouchRectSize.y);
        }

        View.OnPointerUp = function (event) {

            if (event.pointerType == "mouse")
                return;

            var touchPoints = (typeof event.changedTouches != 'undefined') ? event.changedTouches : [event];
            for (var i = 0; i < touchPoints.length; ++i) {
                var touchPoint = touchPoints[i];
                // pick up the unique touchPoint id if we have one or use 1 as the default
                var touchPointId = (typeof touchPoint.identifier != 'undefined') ? touchPoint.identifier : (typeof touchPoint.pointerId != 'undefined') ? touchPoint.pointerId : 0;
                delete View.MsTouchs[touchPointId];
                View.MsTouchsNum--;
            }
        }

        // Regist message to container
        View.addEventListener("mousedown", View.OnMouseDown, false);
        View.addEventListener("mousewheel", View.OnMouseWheel, false);
        document.addEventListener("mouseup", View.OnMouseUp, false);
        document.addEventListener("mousemove", View.OnMouseMove, false);

        View.addEventListener("touchstart", View.OnTouchStart, false);
        View.addEventListener("touchend", View.OnTouchEnd, false);
        View.addEventListener("touchmove", View.OnTouchMove, false);

        View.addEventListener("MSPointerOver", View.OnPointerDown, false);
        View.addEventListener("MSPointerMove", View.OnPointerMove, false);
        View.addEventListener("MSPointerOut", View.OnPointerUp, false);

        View.Process();
        return View;
    }
}
// canvas 显示瓦片
////////////////////////////////////////////////////////////////////////////////
// class of Tile
function XGeoCanvas(id) {
    this.Canvas = document.createElement("canvas");      // HTML5 canvas object
    this.Canvas.id = id;
    this.Canvas.width = 10;
    this.Canvas.height = 10;

    this.Context = this.Canvas.getContext("2d");
    this.PixelSize = new XVertex2(1.0, 1.0);
    this.GeoCenter = new XGeoPoint(0.0, 0.0, 0.0);
    this.GeoLL = new XGeoPoint(-180.0, -90.0, 0);
    this.GeoUR = new XGeoPoint(180.0, 90.0, 0);

    this.SetScreenSize = function (width, height) {
        this.Canvas.width = width;
        this.Canvas.height = height;

        var halfSize = new XVertex2(width / 2.0 * this.PixelSize.x, height / 2.0 * this.PixelSize.y);
        this.GeoLL.llhd(this.GeoCenter.Lon - halfSize.x, this.GeoCenter.Lat - halfSize.y, 0);
        this.GeoUR.llhd(this.GeoCenter.Lon + halfSize.x, this.GeoCenter.Lat + halfSize.y, 0);
    }

    this.SetPixelSize = function (psx, psy) {
        this.PixelSize.xy(psx, psy);
        var geoHalfWidth = psx * this.Canvas.width / 2.0;
        var geoHalfHeight = psy * this.Canvas.height / 2.0;
        this.GeoLL.llhd(this.GeoCenter.Lon - geoHalfWidth, this.GeoCenter.Lat - geoHalfHeight, this.GeoCenter.Hgt);
        this.GeoUR.llhd(this.GeoCenter.Lon + geoHalfWidth, this.GeoCenter.Lat + geoHalfHeight, this.GeoCenter.Hgt);
    }

    this.SetWorldToCenter = function (lond, latd) {
        var lonOff = lond - this.GeoCenter.Lon;
        var latOff = latd - this.GeoCenter.Lat;

        this.GeoCenter.Lon = lond;
        this.GeoCenter.Lat = latd;

        this.GeoLL.llhd(this.GeoLL.Lon + lonOff, this.GeoLL.Lat + latOff, this.GeoLL.Hgt);
        this.GeoUR.llhd(this.GeoUR.Lon + lonOff, this.GeoUR.Lat + latOff, this.GeoUR.Hgt);
    }

    this.SetScreenToWorld = function (scrX, scrY, lond, latd) {
        var curWorld = this.ScreenToWorld(scrX, scrY);
        var lonOff = lond - curWorld.x;
        var latOff = latd - curWorld.y;

        var lonCenter = this.GeoCenter.Lon + lonOff;
        var latCenter = this.GeoCenter.Lat + latOff;

        this.SetWorldToCenter(lonCenter, latCenter);
    }

    this.WorldToScreen = function (lond, latd) {
        var scr = new XVertex2(0, 0);
        scr.x = (lond - this.GeoLL.Lon) / this.PixelSize.x;
        scr.y = (latd - this.GeoLL.Lat) / this.PixelSize.y;
        scr.y = this.Canvas.height - scr.y - 1;
        return scr;
    }

    this.ScreenToWorld = function (scrX, scrY) {
        var world = new XVertex2(0, 0);
        world.x = scrX * this.PixelSize.x + this.GeoLL.Lon;
        world.y = (this.Canvas.height - scrY - 1) * this.PixelSize.y + this.GeoLL.Lat;
        return world;
    }

    this.Draw = function (image, geoRect) {
        var startScrenPos = this.WorldToScreen(geoRect.min.x, geoRect.max.y);
        var endScreenPos = this.WorldToScreen(geoRect.max.x, geoRect.min.y);
        var screenSize = endScreenPos;
        screenSize.Subtract(startScrenPos);

        if (image.width == 0)
            this.Context.fillRect(startScrenPos.x, startScrenPos.y, screenSize.x, screenSize.y);
        else
            this.Context.drawImage(image, startScrenPos.x, startScrenPos.y, screenSize.x + 1, screenSize.y + 1);
    }

    this.DrawIcon = function (image, postion) {
        var half = new XVertex2(image.width / 2.0, image.height / 2.0);
        var startScrenPos = this.WorldToScreen(postion.x, postion.y);
        startScrenPos.Subtract(half);
        this.Context.drawImage(image, startScrenPos.x, startScrenPos.y, image.width, image.height);
    }

    this.Clear = function (color) {
        this.Canvas.width = this.Canvas.width;
    }

    this.SetContainer = function (container) {
        container.appendChild(this.Canvas);
    }

}

//datasource
////////////////////////////////////////////////////////////////////////////////
// XDataSource : base class for dataset
var XDataSource =
{
    CreateNew: function (Projection) {
        var DS = {};

        DS.Projection = Projection;
        DS.MinLevel = -1;
        DS.MaxLevel = -1;

        DS.CheckUsable = function (level, row, col) {
            if (DS.MinLevel >= 0 && level < DS.MinLevel)
                return false;
            if (DS.MaxLevel >= 0 && level > DS.MaxLevel)
                return false;
            return true;
        }

        DS.BuildURL = function (level, row, col) {
            return null;
        }

        return DS;
    }
}
////////////////////////////////////////////////////////////////////////////////
// XDataSource_XNS : Support XDL XNS Standard source
var XDataSource_XNS =
{
    CreateNew: function (ServerURL, Layer) {
        var DS = XDataSource.CreateNew("EPSG:4326");

        // DS.ServerURL = ServerURL + "/xns?/" + Layer + "/";   // ep: http://127.0.0.1:1234/xns?/Map
        DS.ServerURL = ServerURL;
        DS.CheckUsable = function (level, row, col) {
            return true;
        }

        // sample uri: http://127.0.0.1:1234/xns?/Map/0_1_2.jpg;
        DS.BuildURL = function (level, row, col) {
            return DS.ServerURL + level + "_" + row + "_" + col + ".jpg";
        }

        return DS;
    }
}

//layer
////////////////////////////////////////////////////////////////////////////////
// XMapLayer
var XMapLayer =
{
    CreateNew: function (mapview, uuid) {
        var layer = {};

        layer.MapView = mapview;
        layer.MapView.Layers.push(layer);
        layer.UUID = uuid;
        layer.Alpha = 1.0;

        // Virtual functions
        layer.SetPixelSize = function (psx, psy) { }
        layer.SetWorldToCenter = function (lond, latd) { }
        layer.SetScreenToWorld = function (scrX, scrY, lond, latd) { }

        layer.Invalidate = function () { }

        layer.OnSize = function (cx, cy) { }
        layer.OnMouseDown = function (event) { }
        layer.OnMouseMove = function (event) { }
        layer.OnMouseUp = function (event) { }
        layer.OnMouseWheel = function (event) { }
        layer.OnTouchStart = function (event) { }
        layer.OnTouchMove = function (event) { }
        layer.OnTouchEnd = function (event) { }

        layer.OnDraw = function () { }
        layer.OnClear = function () { }

        return layer;
    }
}

////////////////////////////////////////////////////////////////////////////////
// XMapLayerTerrain
var XMapLayerTerrain =
{
    CreateNew: function (mapview, uuid, dataSource, useBlueMarble) {
        if (dataSource.Projection != mapview.Projection)
            return null;

        var layer = XMapLayer.CreateNew(mapview, uuid);

        // Tiles in memory (double buffers , front & back)
        layer.TileMangers = new Array(XMapTileManager.Create(mapview, dataSource), XMapTileManager.Create(mapview, dataSource));
        layer.FrontTM = -1;
        layer.BackTM = -1;

        // BlueMarble
        if (useBlueMarble)
            layer.BlueMarble = XMapBlueMarble.CreateNew(layer.MapView.GeoCanvas, "blueMarble.jpg");

        // Override from XMapLayer
        layer.OnSize = function (cx, cy) {
            layer.Invalidate();
        }

        layer.OnDraw = function () {
            layer.MapView.GeoCanvas.Context.globalAlpha = layer.Alpha;

            // Draw blue marble only when very far to map
            if (layer.MapView.GeoCanvas.PixelSize.x > (X_MAP_L0_PIXEL_SIZE * 2.0)) {
                if (layer.BlueMarble) layer.BlueMarble.Draw();
                return;
            }

            // Init buffer 0 when first call
            if (layer.FrontTM < 0) {
                if (layer.BlueMarble) 
                    layer.BlueMarble.Draw();
                layer.TileMangers[0].UpdateMap();
                layer.FrontTM = 0;
                layer.BackTM = 1;
                return;
            }

            // Swap display buffer
            if (!layer.TileMangers[layer.FrontTM].IsRightLevel()) {
                // Invalidate backbuffer and swap buffer when load over
                if (!layer.TileMangers[layer.BackTM].IsWellResource(false))
                    layer.TileMangers[layer.BackTM].UpdateMap();
                else
                    layer.SwapBuffer();
            }
            else{
                // Update front buffer when front is not enough
                if (!layer.TileMangers[layer.FrontTM].IsWellResource(false))
                    layer.TileMangers[layer.FrontTM].UpdateMap();
            }

            // Draw BlueMarble when buffer is not enough
            if (!layer.TileMangers[layer.FrontTM].IsWellResource(true))
                if (layer.BlueMarble) layer.BlueMarble.Draw();

            // Draw front buffer
            layer.TileMangers[layer.FrontTM].OnDraw();

            // Draw back buffer when backbuffer is loading
            if (!layer.TileMangers[layer.FrontTM].IsRightLevel())
                layer.TileMangers[layer.BackTM].OnDraw();            

            layer.MapView.GeoCanvas.Context.globalAlpha = 1.0;
        }

        layer.SwapBuffer = function() {
            if (layer.FrontTM == 0){
                layer.FrontTM = 1;
                layer.BackTM = 0;                
            }
            else{
                layer.FrontTM = 0;
                layer.BackTM = 1;
            }                    
        }
        return layer;
    }
}

////////////////////////////////////////////////////////////////////////////////
// XMapTileManager
var XMapTileManager =
{
    Create: function (xmap, dataSource) {
        var tm = {};

        tm.MapView = xmap;
        tm.DataSource = dataSource;
        tm.GeoCanvas = xmap.GeoCanvas;

        // Tiles in memory
        tm.Tiles = {};
        tm.TilesLoading = {};

        // Error tile
        tm.ErrorTile = new Image();
        tm.ErrorTile.src = "tileError.png";

        // Quad tile region info
        tm.Level = -1;
        tm.LLRow = 0;
        tm.LLCol = 0;
        tm.URRow = 0;
        tm.URCol = 0;
        tm.MaxRequest = 10;      // this member depends WXDL license and speed of client
        tm.CurRequest = 0;

        // Draw function
        tm.OnDraw = function () {

            var LLRow = GetRowFromLatitude(tm.GeoCanvas.GeoLL.Lat, tm.Level);
            var LLCol = GetColFromLongitude(tm.GeoCanvas.GeoLL.Lon, tm.Level);
            var URRow = GetRowFromLatitude(tm.GeoCanvas.GeoUR.Lat, tm.Level);
            var URCol = GetColFromLongitude(tm.GeoCanvas.GeoUR.Lon, tm.Level);

            for (var _row = LLRow; _row <= URRow; _row++) {
                for (var _col = LLCol; _col <= URCol; _col++) {
                    var key = tm.Level + "_" + _row + "_" + _col;
                    if (tm.Tiles[key]){
                        if(tm.Tiles[key].complete == true)
                            tm.GeoCanvas.Draw(tm.Tiles[key], tm.Tiles[key].GeoBound);
                        else
                            tm.GeoCanvas.Draw(tm.ErrorTile, tm.Tiles[key].GeoBound);                            
                    }
                }
            }

            tm.CancelInvisableLoadingTiles();
            tm.PopLoadCommand();
        }

        // Check visable
        tm.CheckVisable = function (level, row, col) {
            if (level != tm.Level) return false;
            if (row > tm.URRow || row < tm.LLRow) return false;
            if (col > tm.URCol || col < tm.LLCol) return false;
            return true;
        }

        // Check rights
        tm.IsRightLevel = function () {
            var Level = GetAppropriateLevel(X_MAP_L0_PIXEL_SIZE, tm.GeoCanvas.PixelSize.x);
            if (Level != tm.Level) return false;
            return true;
        }

        tm.IsWellResource = function (exceptLevel) {
            // calc visable info (the matrix boundary in target level)
            var Level = GetAppropriateLevel(X_MAP_L0_PIXEL_SIZE, tm.GeoCanvas.PixelSize.x);
            if (exceptLevel)
                Level = tm.Level;
            var LLRow = GetRowFromLatitude(tm.GeoCanvas.GeoLL.Lat, Level);
            var LLCol = GetColFromLongitude(tm.GeoCanvas.GeoLL.Lon, Level);
            var URRow = GetRowFromLatitude(tm.GeoCanvas.GeoUR.Lat, Level);
            var URCol = GetColFromLongitude(tm.GeoCanvas.GeoUR.Lon, Level);

            // check matrix boundary
            if (Level != tm.Level) return false;
            if (LLRow < tm.LLRow) return false;
            if (LLCol < tm.LLCol) return false;
            if (URRow > tm.URRow) return false;
            if (URCol > tm.URCol) return false;

            // check every tile
            for (var _row = tm.LLRow; _row <= tm.URRow; _row++) {
                for (var _col = tm.LLCol; _col <= tm.URCol; _col++) {
                    var key = tm.Level + "_" + _row + "_" + _col;
                    if (!tm.Tiles[key]) {
                        return false;
                    }
                }
            }
            return true;
        }

        // Check visable area and update tiles ( load new tiles and free invisable tiles )
        // Draw visable tiles
        tm.UpdateMap = function () {

            var lstLevel = tm.Level;
            // Calc visable info (the matrix boundary in target level)
            tm.Level = GetAppropriateLevel(X_MAP_L0_PIXEL_SIZE, tm.GeoCanvas.PixelSize.x);
            tm.LLRow = GetRowFromLatitude(tm.GeoCanvas.GeoLL.Lat, tm.Level);
            tm.LLCol = GetColFromLongitude(tm.GeoCanvas.GeoLL.Lon, tm.Level);
            tm.URRow = GetRowFromLatitude(tm.GeoCanvas.GeoUR.Lat, tm.Level);
            tm.URCol = GetColFromLongitude(tm.GeoCanvas.GeoUR.Lon, tm.Level);

            var maxRow = 10;
            for (var i = 0; i < tm.Level; i++) maxRow *= 2;
            var maxCol = maxRow * 2;

            if (tm.LLRow < 0) tm.LLRow = 0;
            if (tm.LLCol < 0) tm.LLCol = 0;
            if (tm.URRow >= maxRow) tm.URRow = maxRow - 1;
            if (tm.URCol >= maxCol) tm.URCol = maxCol - 1;

            // Free invisable tiles
            if (tm.Level != lstLevel) {
                for (var key in tm.Tiles)
                    delete tm.Tiles[key];
            }
            else {
                for (var key in tm.Tiles) {
                    var _keyInfo = key.split('_');
                    if (!tm.CheckVisable(_keyInfo[0], _keyInfo[1], _keyInfo[2]))
                        delete tm.Tiles[key];
                }
            }

            // load new tiles
            for (var _row = tm.LLRow; _row <= tm.URRow; _row++) {
                for (var _col = tm.LLCol; _col <= tm.URCol; _col++) {
                    var key = tm.Level + "_" + _row + "_" + _col;
                    if (!tm.Tiles[key]) {
                        if (tm.DataSource.CheckUsable(tm.Level, _row, _col)) {
                            var tile = XMapTile.CreateNew(tm, tm.Level, _row, _col);
                            tm.TilesLoading[key] = tile;
                        }
                    }
                }
            }
        }

        // Loading callback
        tm.OnTileLoaded = function (tile) {
            var key = tile.Level + "_" + tile.Row + "_" + tile.Col;
            if (tm.CheckVisable(tile.Level, tile.Row, tile.Col)) {
                tm.Tiles[key] = tile;
            }
            tm.MapView.Invalidate();
            tm.CurRequest--;
            //console.log("-loaded("+tm.CurRequest+ "): "+ tile.src);
        }

        tm.OnTileLoadFail = function (tile) {
            var key = tile.Level + "_" + tile.Row + "_" + tile.Col;
            if (tm.CheckVisable(tile.Level, tile.Row, tile.Col)) {
                tm.Tiles[key] = tile;
            }
            tm.MapView.Invalidate();
            tm.CurRequest--;
            //console.log("-loaded("+tm.CurRequest+ "): "+ tile.src);
        }

        // Send requests to loading tiles
        tm.PopLoadCommand = function () {

            if(tm.CurRequest == tm.MaxRequest) return;

            for (var key in tm.TilesLoading) {                
                var tile = tm.TilesLoading[key];
                tile.src = tm.DataSource.BuildURL(tile.Level, tile.Row, tile.Col);
                delete tm.TilesLoading[key];
                tm.CurRequest++;
                //console.log("+loading("+tm.CurRequest+ "): "+ tile.src);
                if(tm.CurRequest >= tm.MaxRequest) return;
            }
        }

        // Cancel loading
        tm.CancelInvisableLoadingTiles = function () {
            // calc visable info (the matrix boundary in target level)
            var Level = GetAppropriateLevel(X_MAP_L0_PIXEL_SIZE, tm.GeoCanvas.PixelSize.x);
            var LLRow = GetRowFromLatitude(tm.GeoCanvas.GeoLL.Lat, Level);
            var LLCol = GetColFromLongitude(tm.GeoCanvas.GeoLL.Lon, Level);
            var URRow = GetRowFromLatitude(tm.GeoCanvas.GeoUR.Lat, Level);
            var URCol = GetColFromLongitude(tm.GeoCanvas.GeoUR.Lon, Level);

            for (var key in tm.TilesLoading) {
                if (tm.TilesLoading[key].Level != Level ||
                   tm.TilesLoading[key].Row < LLRow || tm.TilesLoading[key].Row > URRow ||
                   tm.TilesLoading[key].Col < LLCol || tm.TilesLoading[key].Col > URCol)
                    delete tm.TilesLoading[key];
            }
        }

        return tm;
    }
}
////////////////////////////////////////////////////////////////////////////////
// Tile
var XMapTile =
{
    CreateNew: function (tm, level, row, col) {
        var Tile = new Image;
        Tile.TileManager = tm;
        Tile.Level = level;
        Tile.Row = row;
        Tile.Col = col;
        Tile.TileSize = GetTileSize(X_MAP_L0_TILE_SIZE, level);
        Tile.GeoBound = new XRect(Tile.TileSize * Tile.Col - 180.0,
                                    Tile.TileSize * Tile.Row - 90.0,
                                    Tile.TileSize, Tile.TileSize);
        Tile.onload = function () {
            Tile.TileManager.OnTileLoaded(this);
        }
        Tile.onerror = function () {
            Tile.TileManager.OnTileLoadFail(this);
        }

        return Tile;
    }
}

////////////////////////////////////////////////////////////////////////////////
// BlueMarble
var XMapBlueMarble =
{
    CreateNew: function (xCanvas, url) {
        var BlueMarble = new Image;
        BlueMarble.XCanvas = xCanvas;
        BlueMarble.GeoBound = new XRect(-180.0, -90.0, 360.0, 180.0);
        BlueMarble.bLoaded = false;

        BlueMarble.Draw = function () {
            if (!BlueMarble.bLoaded) return;
            this.XCanvas.Draw(this, this.GeoBound);
        }

        BlueMarble.onload = function () {
            BlueMarble.bLoaded = true;
            BlueMarble.Draw();
        }

        BlueMarble.src = url;

        return BlueMarble;
    }
}
//tile
//tilemanager
//结构体
// XVertex2
function XVertex2(x, y) {
    this.x = x;
    this.y = y;

    // Properties
    this.xy = function (x, y) {
        this.x = x;
        this.y = y;
    }

    // Api
    this.Abs = function () {
        this.x = abs(this.x);
        this.y = abs(this.y);
    }

    // Operator +   
    this.Add = function (v) {
        this.x += v.x;
        this.y += v.y;
    }

    // Operator -
    this.Subtract = function (v) {
        this.x -= v.x;
        this.y -= v.y;
    }

    // - Operator
    this.Inverse = function () {
        this.x = -this.x;
        this.y = -this.y;
    }

    // == Operator
    this.Equal = function (v) {
        if(this.x != v.x || this.y != v.y)
            return false;
        return true;
    }
}

///////////////////////////////////////////////////////////////////////////////
// XVertex3
function XVertex3(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;

    // Properties
    this.xyz = function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    // Api
    this.Abs = function () {
        this.x = abs(this.x);
        this.y = abs(this.y);
        this.z = abs(this.z);
    }

    // Operator +   
    this.Add = function (v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
    }

    // Operator -
    this.Subtract = function (v) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
    }

    // - Operator
    this.Inverse = function () {
        this.x = -this.x;
        this.y = -this.y;
        this.z = -this.z;
    }

    // == Operator
    this.Equal = function (v) {
        if(this.x != v.x || this.y != v.y || this.z != v.z)
            return false;
        return true;
    }
}