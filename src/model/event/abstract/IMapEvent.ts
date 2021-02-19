import IMapObject from "../../object/abstract/IMapObject";

/**
 * This class provides abstract map event object.
 * 
 * @author Jiri Hynek
 */
interface IMapEvent {
    
    /**
     * Returns string which identifies the event.
     */
    getType(): string;

    /**
     * Return source object of the event.
     */
    getSource(): IMapObject;
}
export default IMapEvent;