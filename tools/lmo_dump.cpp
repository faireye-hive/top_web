// Small JSON bridge for the original portable ModelFile reader.
#include "top/ModelFile.h"
#include <iomanip>
#include <iostream>
template<class T> void array(const T& values){
    std::cout << '[';bool first=true;
    for(const auto& value:values){if(!first)std::cout << ',';first=false;std::cout << +value;}
    std::cout << ']';
}
int main(int argc,char** argv){
    if(argc!=2)return 2;
    top::Model model;if(!model.load(argv[1]))return 1;
    std::cout << "{\"geoms\":[";bool first=true;
    for(const auto& geom:model.geoms){
        if(!first)std::cout << ',';first=false;
        std::cout << "{\"matrix\":";array(geom.local);
        std::cout << ",\"parent\":" << geom.parent << ",\"pos\":";array(geom.position);
        std::cout << ",\"normal\":";array(geom.normal);
        std::cout << ",\"uv\":";array(geom.uv);
        std::cout << ",\"indices\":";array(geom.indices);
        std::cout << ",\"subsets\":[";bool firstSubset=true;
        for(const auto& subset:geom.subsets){
            if(!firstSubset)std::cout << ',';firstSubset=false;
            std::cout << "{\"start\":" << subset.startIndex << ",\"count\":" << subset.indexCount
                      << ",\"texture\":" << std::quoted(subset.texture) << ",\"blend\":" << subset.blend << '}';
        }
        std::cout << "]}";
    }
    std::cout << "]}";
}
